import bcrypt from "bcryptjs";
import { $ } from "bun";
import pool from "../../src/database.js";

async function initDb() {
  await $`node-pg-migrate up`.quiet();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Nettoyage complet
    await client.query(
      "TRUNCATE TABLE organisations, users, roles, permissions, role_permissions, teams, team_users, channels, channel_team_users, messages, documents, message_reaction_users, user_roles RESTART IDENTITY CASCADE",
    );

    // Création de l'organisation
    const { rows: orgs } = await client.query(`
      INSERT INTO organisations (nom) VALUES ('Test Org') RETURNING id
    `);
    const orgId = orgs[0].id;

    // Création des Rôles
    const { rows: roles } = await client.query(`
      INSERT INTO roles (name, is_admin, is_super_admin) VALUES 
      ('admin', true, true), ('member', false, false) RETURNING id, name
    `);
    const adminId = roles.find((r) => r.name === "admin").id;
    const memberId = roles.find((r) => r.name === "member").id;

    // Création des Utilisateurs (John & Jane)
    const hash = await bcrypt.hash("password123", 10);
    const { rows: users } = await client.query(
      `
      INSERT INTO users (firstname, lastname, email, username, password, org_id) VALUES 
      ('John', 'Doe', 'john.doe@lime.app', 'johndoe', $1, $2),
      ('Jane', 'Doe', 'jane.doe@lime.app', 'janedoe', $1, $2) RETURNING id, username
    `,
      [hash, orgId],
    );
    const johnId = users.find((u) => u.username === "johndoe").id;
    const janeId = users.find((u) => u.username === "janedoe").id;

    // Création de l'Équipe et du Canal
    const { rows: teams } = await client.query(
      `INSERT INTO teams (name, org_id) VALUES ('Test Team', $1) RETURNING id`,
      [orgId],
    );
    const { rows: channels } = await client.query(
      `INSERT INTO channels (name, org_id) VALUES ('général-test', $1) RETURNING id`,
      [orgId],
    );
    const teamId = teams[0].id;
    const channelId = channels[0].id;

    // Liaisons (Membres d'équipe, permissions)
    await client.query(
      `INSERT INTO team_users (team_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [teamId, johnId, janeId],
    );
    await client.query(
      `INSERT INTO channel_team_users (channel_id, team_id, org_id) VALUES ($1, $2, $3)`,
      [channelId, teamId, orgId],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [johnId, adminId, teamId, janeId, memberId, teamId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDb().catch(console.error);
