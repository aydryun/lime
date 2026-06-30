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

    // --- Permissions ---
    const permissions = [
      { category: "message", action: "GET" },
      { category: "message", action: "CREATE" },
      { category: "message", action: "UPDATE" },
      { category: "message", action: "DELETE" },
      { category: "channel", action: "GET" },
      { category: "channel", action: "CREATE" },
      { category: "channel", action: "UPDATE" },
      { category: "channel", action: "DELETE" },
      { category: "team", action: "GET" },
      { category: "team", action: "CREATE" },
      { category: "team", action: "UPDATE" },
      { category: "team", action: "DELETE" },
    ];

    const permissionIds: number[] = [];

    for (const p of permissions) {
      const result = await client.query(
        `INSERT INTO permissions (category, action)
         VALUES ($1, $2::permission_action)
         ON CONFLICT (category, action) DO UPDATE SET category = EXCLUDED.category
         RETURNING id`,
        [p.category, p.action],
      );
      permissionIds.push(result.rows[0].id);
    }
    console.log(`✓ ${permissions.length} permissions créées`);

    // --- Role permissions ---
    // Admin : toutes les permissions
    for (const pid of permissionIds) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
        [roleIds.admin, pid],
      );
    }

    // Moderator : GET + CREATE + UPDATE (pas DELETE)
    for (const pid of permissionIds) {
      const perm = permissions[permissionIds.indexOf(pid)];
      if (perm.action !== "DELETE") {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleIds.moderator, pid],
        );
      }
    }

    // Member : GET + CREATE uniquement
    for (const pid of permissionIds) {
      const perm = permissions[permissionIds.indexOf(pid)];
      if (perm.action === "GET" || perm.action === "CREATE") {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleIds.member, pid],
        );
      }
    }
    console.log("✓ Permissions attribuées aux rôles");

    // --- Teams ---
    const teamResult = await client.query(
      `INSERT INTO teams (name, org_id) VALUES ($1, $2) RETURNING id`,
      ["Équipe Lime", orgId],
    );
    const teamId = teamResult.rows[0].id;
    console.log("✓ Team créée : Équipe Lime");

    // --- Team users ---
    for (const username of Object.keys(userIds)) {
      await client.query(
        `INSERT INTO team_users (team_id, user_id) VALUES ($1, $2)`,
        [teamId, userIds[username]],
      );
    }
    console.log("✓ Utilisateurs ajoutés à la team");

    // --- Channels ---
    const channelNames = ["général", "random", "dev"];
    const channelIds: Record<string, number> = {};

    for (const name of channelNames) {
      const result = await client.query(
        `INSERT INTO channels (name, org_id) VALUES ($1, $2) RETURNING id`,
        [name, orgId],
      );
      channelIds[name] = result.rows[0].id;
    }
    console.log(`✓ Channels créés : ${channelNames.join(", ")}`);

    // --- Channel team users (la team a accès à tous les channels) ---
    for (const name of channelNames) {
      await client.query(
        `INSERT INTO channel_team_users (channel_id, team_id) VALUES ($1, $2)`,
        [channelIds[name], teamId],
      );
    }
    console.log("✓ Team liée aux channels");

    // --- Channel roles per user ---
    // Un owner différent par canal pour faciliter les tests.
    const channelOwners: Record<string, string> = {
      général: "admin",
      random: "julie",
      dev: "lucas",
    };
    const channelAdmins: Record<string, string[]> = {
      général: ["julie"],
      random: [],
      dev: [],
    };

    for (const name of channelNames) {
      const ownerUsername = channelOwners[name];
      const adminUsernames = channelAdmins[name] ?? [];
      for (const username of Object.keys(userIds)) {
        let roleName: "canal_owner" | "canal_admin" | "canal_member";
        if (username === ownerUsername) roleName = "canal_owner";
        else if (adminUsernames.includes(username)) roleName = "canal_admin";
        else roleName = "canal_member";
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, channel_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
          [userIds[username], roleIds[roleName], channelIds[name]],
        );
      }
    }
    console.log("✓ Rôles canal attribués");

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

    // --- User roles ---
    // Admin : rôle admin sur la team
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
      [userIds.admin, roleIds.admin, teamId],
    );

    // Julie : moderator sur la team
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
      [userIds.julie, roleIds.moderator, teamId],
    );

    // Lucas : member sur la team
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0)) DO NOTHING`,
      [userIds.lucas, roleIds.member, teamId],
    );
    console.log("✓ Rôles attribués aux utilisateurs");

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
