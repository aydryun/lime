import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "chat_db",
});

/** Returns the full user row matching the given email, or null. */
export async function findUserByEmail(email: string) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

/** Returns the public profile of the user with the given id, or null. */
export async function findUserById(id: number) {
  const result = await pool.query(
    "SELECT id, firstname, lastname, email, username FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0] || null;
}

/** Resolves a role name to its roles.id (cached after first lookup). */
const roleIdCache = new Map<string, number>();
export async function getRoleId(name: string): Promise<number> {
  const cached = roleIdCache.get(name);
  if (cached) return cached;
  const result = await pool.query(
    "SELECT id FROM roles WHERE name = $1 LIMIT 1",
    [name],
  );
  const id = result.rows[0]?.id as number | undefined;
  if (!id) throw new Error(`Missing role in DB: ${name}`);
  roleIdCache.set(name, id);
  return id;
}

/**
 * Registers a new tenant: creates an organisation, its first user, and grants
 * that user the org_owner role — atomically. Returns the user public profile.
 */
export async function createUserWithOrganisation(
  firstname: string,
  lastname: string,
  email: string,
  username: string,
  hashedPassword: string,
  organisationName: string,
) {
  const ownerRoleId = await getRoleId("org_owner");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const org = await client.query(
      `INSERT INTO organisations (nom) VALUES ($1) RETURNING id, nom`,
      [organisationName],
    );
    const orgId = org.rows[0].id as number;
    const user = await client.query(
      `INSERT INTO users (firstname, lastname, email, username, password, org_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, firstname, lastname, email, username, org_id`,
      [firstname, lastname, email, username, hashedPassword, orgId],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)`,
      [user.rows[0].id, ownerRoleId, orgId],
    );
    await client.query("COMMIT");
    return user.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Updates the profile of an existing user; returns the updated public profile or null if not found. */
export async function updateUser(
  id: number,
  firstname: string,
  lastname: string,
  email: string,
  username: string,
) {
  const result = await pool.query(
    `UPDATE users
     SET firstname = $1, lastname = $2, email = $3, username = $4
     WHERE id = $5
     RETURNING id, firstname, lastname, email, username`,
    [firstname, lastname, email, username, id],
  );
  return result.rows[0] || null;
}

/** Returns the bcrypt hash for the given user id (used to verify current password). */
export async function getUserPasswordById(id: number): Promise<string | null> {
  const result = await pool.query("SELECT password FROM users WHERE id = $1", [
    id,
  ]);
  return result.rows[0]?.password ?? null;
}

/** Updates the password hash for a user; returns true if a row was actually modified. */
export async function updateUserPassword(
  id: number,
  hashedPassword: string,
): Promise<boolean> {
  const result = await pool.query(
    "UPDATE users SET password = $1 WHERE id = $2",
    [hashedPassword, id],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Returns every message of a channel with its sender username, oldest first. */
export async function getChannelMessages(
  channelId: number,
): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT m.id, m.channel_id, m.user_id, u.username AS sender,
            m.content, m.created_at, m.is_updated, m.is_pinned
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = $1
     ORDER BY m.created_at ASC`,
    [channelId],
  );
  return result.rows;
}

/** Inserts a new message in a channel and returns the persisted row (with sender username). */
export async function insertChannelMessage(
  channelId: number,
  userId: number,
  content: string,
) {
  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO messages (channel_id, user_id, content, org_id)
       VALUES ($1, $2, $3, (SELECT org_id FROM channels WHERE id = $1))
       RETURNING id, channel_id, user_id, content, created_at, is_updated, is_pinned, org_id
     )
     SELECT i.*, u.username AS sender
     FROM inserted i
     JOIN users u ON u.id = i.user_id`,
    [channelId, userId, content],
  );
  return result.rows[0];
}

// ─── Channels ─────────────────────────────────────────────────────────────

export type ChannelRow = {
  id: number;
  name: string;
};

export type CanalRole = "canal_owner" | "canal_admin" | "canal_member";
const CANAL_ROLE_NAMES: CanalRole[] = [
  "canal_owner",
  "canal_admin",
  "canal_member",
];

/** Resolves a canal role name to its roles.id (cached after first lookup). */
const canalRoleIdCache = new Map<CanalRole, number>();
export async function getCanalRoleId(role: CanalRole): Promise<number> {
  const cached = canalRoleIdCache.get(role);
  if (cached) return cached;
  const result = await pool.query(
    "SELECT id FROM roles WHERE name = $1 LIMIT 1",
    [role],
  );
  const id = result.rows[0]?.id as number | undefined;
  if (!id) throw new Error(`Missing role in DB: ${role}`);
  canalRoleIdCache.set(role, id);
  return id;
}

/** Channels visible to a user: direct membership, via team, or via user_roles canal entry. */
export async function listUserChannels(
  userId: number,
  orgId: number,
): Promise<Array<ChannelRow & { my_role: CanalRole }>> {
  const result = await pool.query(
    `WITH my_channels AS (
       SELECT DISTINCT c.id, c.name
       FROM channels c
       LEFT JOIN channel_team_users ctu ON ctu.channel_id = c.id
       LEFT JOIN team_users tu
         ON tu.team_id = ctu.team_id AND tu.user_id = $1
       LEFT JOIN user_roles ur
         ON ur.channel_id = c.id AND ur.user_id = $1
         AND ur.role_id IN (SELECT id FROM roles WHERE name = ANY($2::text[]))
       WHERE c.org_id = $3
         AND (ctu.user_id = $1 OR tu.user_id = $1 OR ur.id IS NOT NULL)
     )
     SELECT mc.id, mc.name,
            COALESCE(
              (SELECT r.name FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = $1 AND ur.channel_id = mc.id
                  AND r.name = ANY($2::text[])
                ORDER BY CASE r.name
                  WHEN 'canal_owner' THEN 0
                  WHEN 'canal_admin' THEN 1
                  ELSE 2 END
                LIMIT 1),
              'canal_member'
            ) AS my_role
     FROM my_channels mc
     ORDER BY mc.id ASC`,
    [userId, CANAL_ROLE_NAMES, orgId],
  );
  return result.rows;
}

/** Returns a channel row by id, or null. */
export async function findChannelById(id: number): Promise<ChannelRow | null> {
  const result = await pool.query(
    "SELECT id, name FROM channels WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

/** Creates a channel; creator becomes canal_owner. */
export async function createChannel(
  name: string,
  creatorId: number,
): Promise<ChannelRow> {
  const ownerRoleId = await getCanalRoleId("canal_owner");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const channel = await client.query(
      `INSERT INTO channels (name, org_id)
       VALUES ($1, (SELECT org_id FROM users WHERE id = $2))
       RETURNING id, name`,
      [name, creatorId],
    );
    const channelRow = channel.rows[0] as ChannelRow;
    await client.query(
      `INSERT INTO channel_team_users (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [channelRow.id, creatorId],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, channel_id)
       VALUES ($1, $2, $3)`,
      [creatorId, ownerRoleId, channelRow.id],
    );
    await client.query("COMMIT");
    return channelRow;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Renames a channel; returns updated row or null. */
export async function renameChannel(
  id: number,
  name: string,
): Promise<ChannelRow | null> {
  const result = await pool.query(
    `UPDATE channels SET name = $1 WHERE id = $2 RETURNING id, name`,
    [name, id],
  );
  return result.rows[0] ?? null;
}

/** Deletes a channel and everything attached to it. */
export async function deleteChannel(id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM message_reaction_users WHERE message_id IN (SELECT id FROM messages WHERE channel_id = $1)",
      [id],
    );
    await client.query("DELETE FROM documents WHERE channel_id = $1", [id]);
    await client.query("DELETE FROM messages WHERE channel_id = $1", [id]);
    await client.query("DELETE FROM channel_team_users WHERE channel_id = $1", [
      id,
    ]);
    await client.query("DELETE FROM user_roles WHERE channel_id = $1", [id]);
    const result = await client.query("DELETE FROM channels WHERE id = $1", [
      id,
    ]);
    await client.query("COMMIT");
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export type ChannelMember = {
  user_id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: CanalRole;
};

/**
 * Members of a channel = union of:
 *  - users with a canal_* user_roles entry for the channel,
 *  - users in channel_team_users.user_id,
 *  - users in any team linked via channel_team_users.team_id.
 * Default role is canal_member when no explicit user_roles entry exists.
 */
export async function listChannelMembers(
  channelId: number,
): Promise<ChannelMember[]> {
  const result = await pool.query(
    `WITH member_ids AS (
       SELECT DISTINCT user_id FROM (
         SELECT user_id FROM channel_team_users
         WHERE channel_id = $1 AND user_id IS NOT NULL
         UNION
         SELECT tu.user_id FROM channel_team_users ctu
         JOIN team_users tu ON tu.team_id = ctu.team_id
         WHERE ctu.channel_id = $1 AND ctu.team_id IS NOT NULL
         UNION
         SELECT ur.user_id FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.channel_id = $1 AND r.name = ANY($2::text[])
       ) src
     )
     SELECT u.id AS user_id, u.username, u.firstname, u.lastname,
            COALESCE(
              (SELECT r.name FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id AND ur.channel_id = $1
                  AND r.name = ANY($2::text[])
                ORDER BY CASE r.name
                  WHEN 'canal_owner' THEN 0
                  WHEN 'canal_admin' THEN 1
                  ELSE 2 END
                LIMIT 1),
              'canal_member'
            ) AS role
     FROM member_ids mi
     JOIN users u ON u.id = mi.user_id
     ORDER BY CASE COALESCE(
                (SELECT r.name FROM user_roles ur
                  JOIN roles r ON r.id = ur.role_id
                  WHERE ur.user_id = u.id AND ur.channel_id = $1
                    AND r.name = ANY($2::text[])
                  LIMIT 1),
                'canal_member'
              )
              WHEN 'canal_owner' THEN 0
              WHEN 'canal_admin' THEN 1
              ELSE 2
            END,
            u.username ASC`,
    [channelId, CANAL_ROLE_NAMES],
  );
  return result.rows;
}

/** Returns the canal role of a user for a channel, or null if not a member. */
export async function getUserChannelRole(
  channelId: number,
  userId: number,
  orgId: number,
): Promise<CanalRole | null> {
  // Isolation tenant : un canal hors de l'org de l'appelant n'existe pas pour lui.
  const inOrg = await pool.query(
    "SELECT 1 FROM channels WHERE id = $1 AND org_id = $2",
    [channelId, orgId],
  );
  if ((inOrg.rowCount ?? 0) === 0) return null;

  const explicit = await pool.query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND ur.channel_id = $2
       AND r.name = ANY($3::text[])
     ORDER BY CASE r.name
       WHEN 'canal_owner' THEN 0
       WHEN 'canal_admin' THEN 1
       ELSE 2 END
     LIMIT 1`,
    [userId, channelId, CANAL_ROLE_NAMES],
  );
  if (explicit.rows[0]?.name) return explicit.rows[0].name as CanalRole;

  const membership = await pool.query(
    `SELECT 1
     FROM channel_team_users ctu
     LEFT JOIN team_users tu
       ON tu.team_id = ctu.team_id AND tu.user_id = $1
     WHERE ctu.channel_id = $2
       AND (ctu.user_id = $1 OR tu.user_id = $1)
     LIMIT 1`,
    [userId, channelId],
  );
  return (membership.rowCount ?? 0) > 0 ? "canal_member" : null;
}

/** Adds a user to a channel as canal_member. Returns true if newly added. */
export async function addChannelMember(
  channelId: number,
  userId: number,
): Promise<boolean> {
  const memberRoleId = await getCanalRoleId("canal_member");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Isolation tenant : on ne peut ajouter qu'un utilisateur de la même org que le canal.
    const sameOrg = await client.query(
      `SELECT 1 FROM users u JOIN channels c ON c.id = $2
       WHERE u.id = $1 AND u.org_id = c.org_id`,
      [userId, channelId],
    );
    if ((sameOrg.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    const ins = await client.query(
      `INSERT INTO channel_team_users (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [channelId, userId],
    );
    const existing = await client.query(
      `SELECT 1 FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND ur.channel_id = $2
         AND r.name = ANY($3::text[])
       LIMIT 1`,
      [userId, channelId, CANAL_ROLE_NAMES],
    );
    if ((existing.rowCount ?? 0) === 0) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, channel_id)
         VALUES ($1, $2, $3)`,
        [userId, memberRoleId, channelId],
      );
    }
    await client.query("COMMIT");
    return (ins.rowCount ?? 0) > 0 || (existing.rowCount ?? 0) === 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Removes a user from a channel (drops both channel_team_users + canal_* user_roles). */
export async function removeChannelMember(
  channelId: number,
  userId: number,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query(
      `DELETE FROM channel_team_users
       WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId],
    );
    const b = await client.query(
      `DELETE FROM user_roles
       WHERE channel_id = $1 AND user_id = $2
         AND role_id IN (SELECT id FROM roles WHERE name = ANY($3::text[]))`,
      [channelId, userId, CANAL_ROLE_NAMES],
    );
    await client.query("COMMIT");
    return (a.rowCount ?? 0) + (b.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Replaces a user's canal role within a channel (used for promote/demote). */
export async function setChannelRole(
  channelId: number,
  userId: number,
  role: CanalRole,
): Promise<void> {
  const roleId = await getCanalRoleId(role);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM user_roles
       WHERE channel_id = $1 AND user_id = $2
         AND role_id IN (SELECT id FROM roles WHERE name = ANY($3::text[]))`,
      [channelId, userId, CANAL_ROLE_NAMES],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, channel_id)
       VALUES ($1, $2, $3)`,
      [userId, roleId, channelId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transfers ownership of a channel from current owner to newOwnerId, then
 * removes the previous owner from the channel ("leave after transfer").
 */
export async function transferChannelOwnership(
  channelId: number,
  previousOwnerId: number,
  newOwnerId: number,
): Promise<void> {
  const ownerRoleId = await getCanalRoleId("canal_owner");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Wipe target's canal_* roles and promote them to owner.
    await client.query(
      `DELETE FROM user_roles
       WHERE channel_id = $1 AND user_id = $2
         AND role_id IN (SELECT id FROM roles WHERE name = ANY($3::text[]))`,
      [channelId, newOwnerId, CANAL_ROLE_NAMES],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, channel_id)
       VALUES ($1, $2, $3)`,
      [newOwnerId, ownerRoleId, channelId],
    );
    // Make sure they're a direct member too.
    await client.query(
      `INSERT INTO channel_team_users (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [channelId, newOwnerId],
    );
    // Remove the previous owner from the channel entirely.
    await client.query(
      `DELETE FROM channel_team_users
       WHERE channel_id = $1 AND user_id = $2`,
      [channelId, previousOwnerId],
    );
    await client.query(
      `DELETE FROM user_roles
       WHERE channel_id = $1 AND user_id = $2
         AND role_id IN (SELECT id FROM roles WHERE name = ANY($3::text[]))`,
      [channelId, previousOwnerId, CANAL_ROLE_NAMES],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Lists users not already members of the channel (for "add member" picker). */
export async function listNonMembers(
  channelId: number,
  search: string,
): Promise<
  Array<{ id: number; username: string; firstname: string; lastname: string }>
> {
  const like = `%${search}%`;
  const result = await pool.query(
    `SELECT u.id, u.username, u.firstname, u.lastname
     FROM users u
     WHERE u.org_id = (SELECT org_id FROM channels WHERE id = $1)
     AND u.id NOT IN (
       SELECT user_id FROM channel_team_users
       WHERE channel_id = $1 AND user_id IS NOT NULL
       UNION
       SELECT tu.user_id FROM channel_team_users ctu
       JOIN team_users tu ON tu.team_id = ctu.team_id
       WHERE ctu.channel_id = $1 AND ctu.team_id IS NOT NULL
       UNION
       SELECT ur.user_id FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.channel_id = $1 AND r.name = ANY($2::text[])
     )
     AND (
       $3 = '' OR
       u.username ILIKE $4 OR u.firstname ILIKE $4 OR u.lastname ILIKE $4
     )
     ORDER BY u.username ASC
     LIMIT 20`,
    [channelId, CANAL_ROLE_NAMES, search, like],
  );
  return result.rows;
}

export default pool;
