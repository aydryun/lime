import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pool from "./src/database.js";

dotenv.config({ path: "../.env" });

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --- Organisation (tenant) ---
    const orgResult = await client.query(
      `INSERT INTO organisations (nom) VALUES ($1) RETURNING id`,
      ["Organisation Lime"],
    );
    const orgId = orgResult.rows[0].id;
    console.log("✓ Organisation créée : Organisation Lime");

    // --- Users ---
    const users = [
      {
        firstname: "Julie",
        lastname: "Dupont",
        email: "julie@lime.app",
        username: "julie",
        password: "password123",
      },
      {
        firstname: "Lucas",
        lastname: "Martin",
        email: "lucas@lime.app",
        username: "lucas",
        password: "password123",
      },
      {
        firstname: "Admin",
        lastname: "Lime",
        email: "admin@lime.app",
        username: "admin",
        password: "admin123",
      },
    ];

    const userIds: Record<string, number> = {};

    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10);
      const result = await client.query(
        `INSERT INTO users (firstname, lastname, email, username, password, org_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, username`,
        [u.firstname, u.lastname, u.email, u.username, hashed, orgId],
      );
      userIds[result.rows[0].username] = result.rows[0].id;
      console.log(
        `✓ Utilisateur créé : ${result.rows[0].username} (${u.email})`,
      );
    }

    // --- Roles ---
    const roles = [
      { name: "admin", is_admin: true, is_super_admin: true },
      { name: "moderator", is_admin: true, is_super_admin: false },
      { name: "member", is_admin: false, is_super_admin: false },
      { name: "team_owner", is_admin: true, is_super_admin: false },
      { name: "team_admin", is_admin: true, is_super_admin: false },
      { name: "team_member", is_admin: false, is_super_admin: false },
      { name: "org_owner", is_admin: true, is_super_admin: false },
      { name: "org_admin", is_admin: true, is_super_admin: false },
      { name: "canal_owner", is_admin: true, is_super_admin: false },
      { name: "canal_admin", is_admin: true, is_super_admin: false },
      { name: "canal_member", is_admin: false, is_super_admin: false },
      { name: "canal_reader", is_admin: false, is_super_admin: false },
    ];

    const roleIds: Record<string, number> = {};

    for (const r of roles) {
      const result = await client.query(
        `INSERT INTO roles (name, is_admin, is_super_admin)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
           SET is_admin = EXCLUDED.is_admin,
               is_super_admin = EXCLUDED.is_super_admin
         RETURNING id, name`,
        [r.name, r.is_admin, r.is_super_admin],
      );
      roleIds[result.rows[0].name] = result.rows[0].id;
      console.log(`✓ Rôle créé : ${result.rows[0].name}`);
    }

    // --- Permissions & role_permissions ---
    // Volontairement NON gérées ici : le mapping rôles ↔ permissions est seedé
    // par les migrations (019 → 022), source unique de vérité du RBAC. Le seeder
    // en base éviterait notamment d'accorder par erreur channel:CREATE au rôle
    // `member` (ce qui laisserait un membre simple créer des canaux org-wide).

    // --- Équipes (hiérarchie : une équipe racine + une sous-équipe) ---
    const rootTeamRes = await client.query(
      `INSERT INTO teams (name, org_id) VALUES ($1, $2) RETURNING id`,
      ["Équipe Lime", orgId],
    );
    const teamId = rootTeamRes.rows[0].id;
    const devTeamRes = await client.query(
      `INSERT INTO teams (name, org_id, parent_team_id) VALUES ($1, $2, $3) RETURNING id`,
      ["Dev", orgId, teamId],
    );
    const devTeamId = devTeamRes.rows[0].id;
    console.log("✓ Équipes créées : Équipe Lime + sous-équipe Dev");

    // --- Membres d'équipe + rôles team-scopés ---
    // Équipe Lime : admin=owner, julie=admin, lucas=member.
    // Sous-équipe Dev : lucas=owner — illustre la cascade (admin, org_owner ET
    // team_owner du parent, gère aussi Dev sans en être membre direct).
    const teamMemberships = [
      { team: teamId, user: "admin", role: "team_owner" },
      { team: teamId, user: "julie", role: "team_admin" },
      { team: teamId, user: "lucas", role: "team_member" },
      { team: devTeamId, user: "lucas", role: "team_owner" },
    ];
    for (const m of teamMemberships) {
      await client.query(
        `INSERT INTO team_users (team_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [m.team, userIds[m.user]],
      );
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
        [userIds[m.user], roleIds[m.role], m.team],
      );
    }
    console.log("✓ Membres et rôles d'équipe attribués");

    // --- Canaux ---
    // "général" : canal org-wide (tous les membres de l'org y accèdent) ;
    // "random"  : lié à l'équipe racine (membres directs) ;
    // "dev"     : lié à l'équipe racine ET étendu au sous-arbre
    //             (include_descendants) → les membres de la sous-équipe Dev y
    //             accèdent aussi.
    const canalMemberRoleId = roleIds.canal_member;
    const channelIds: Record<string, number> = {};
    channelIds.général = (
      await client.query(
        `INSERT INTO channels (name, org_id, is_org_wide, default_role_id)
         VALUES ($1, $2, TRUE, $3) RETURNING id`,
        ["général", orgId, canalMemberRoleId],
      )
    ).rows[0].id;
    channelIds.random = (
      await client.query(
        `INSERT INTO channels (name, org_id) VALUES ($1, $2) RETURNING id`,
        ["random", orgId],
      )
    ).rows[0].id;
    channelIds.dev = (
      await client.query(
        `INSERT INTO channels (name, org_id) VALUES ($1, $2) RETURNING id`,
        ["dev", orgId],
      )
    ).rows[0].id;
    console.log("✓ Canaux créés : général (org-wide), random, dev");

    // --- Liens d'équipe vers les canaux ---
    await client.query(
      `INSERT INTO channel_team_users (channel_id, team_id, include_descendants, default_role_id, org_id)
       VALUES ($1, $2, FALSE, $3, $4) ON CONFLICT DO NOTHING`,
      [channelIds.random, teamId, canalMemberRoleId, orgId],
    );
    await client.query(
      `INSERT INTO channel_team_users (channel_id, team_id, include_descendants, default_role_id, org_id)
       VALUES ($1, $2, TRUE, $3, $4) ON CONFLICT DO NOTHING`,
      [channelIds.dev, teamId, canalMemberRoleId, orgId],
    );
    console.log("✓ Équipe liée aux canaux (dev étendu au sous-arbre)");

    // --- Rôles canal explicites ---
    // Un propriétaire par canal + un lecteur seule (canal_reader) pour la démo.
    const channelRoles = [
      { channel: channelIds.général, user: "admin", role: "canal_owner" },
      { channel: channelIds.random, user: "julie", role: "canal_owner" },
      { channel: channelIds.random, user: "lucas", role: "canal_reader" },
      { channel: channelIds.dev, user: "lucas", role: "canal_owner" },
      { channel: channelIds.dev, user: "julie", role: "canal_admin" },
    ];
    for (const cr of channelRoles) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, channel_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
        [userIds[cr.user], roleIds[cr.role], cr.channel],
      );
    }
    console.log("✓ Rôles canal attribués (dont un canal_reader)");

    // --- Messages ---
    const messages = [
      {
        username: "julie",
        channel: "général",
        content: "Salut tout le monde !",
      },
      {
        username: "lucas",
        channel: "général",
        content: "Hey ! Comment ça va ?",
      },
      {
        username: "admin",
        channel: "général",
        content: "Bienvenue sur Lime 🍋",
      },
      {
        username: "julie",
        channel: "random",
        content: "Quelqu'un veut un café ?",
      },
      {
        username: "lucas",
        channel: "dev",
        content: "Le nouveau schema est prêt !",
      },
    ];

    const messageIds: number[] = [];

    for (const m of messages) {
      const result = await client.query(
        `INSERT INTO messages (channel_id, user_id, content, org_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [channelIds[m.channel], userIds[m.username], m.content, orgId],
      );
      messageIds.push(result.rows[0].id);
    }
    console.log(`✓ ${messages.length} messages créés`);

    // --- Reactions ---
    await client.query(
      `INSERT INTO message_reaction_users (message_id, user_id, reaction)
       VALUES ($1, $2, $3)`,
      [messageIds[0], userIds.lucas, "👍"],
    );
    await client.query(
      `INSERT INTO message_reaction_users (message_id, user_id, reaction)
       VALUES ($1, $2, $3)`,
      [messageIds[2], userIds.julie, "🍋"],
    );
    await client.query(
      `INSERT INTO message_reaction_users (message_id, user_id, reaction)
       VALUES ($1, $2, $3)`,
      [messageIds[2], userIds.lucas, "🍋"],
    );
    console.log("✓ Réactions ajoutées");

    // --- Org roles ---
    // Admin : owner de l'org ; Julie : admin de l'org.
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
      [userIds.admin, roleIds.org_owner, orgId],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
      [userIds.julie, roleIds.org_admin, orgId],
    );
    // Lucas : membre simple de l'org (ne voit que les teams auxquelles il appartient).
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
      [userIds.lucas, roleIds.member, orgId],
    );
    console.log("✓ Rôles org attribués");

    await client.query("COMMIT");
    console.log("\n✓ Seed terminé");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
