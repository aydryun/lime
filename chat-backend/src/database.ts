import pkg from "pg";

const { Pool } = pkg;

// DB_SSL=true active le TLS exigé par la BDD externe (Neon), avec vérification
// du certificat (rejectUnauthorized:true) : la CA de Neon est publique, donc
// présente dans le store système — pas de CA custom à fournir.
const ssl =
  process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false;

// En production, la BDD est externe (Neon) : DATABASE_URL est OBLIGATOIRE.
// On échoue tôt plutôt que de retomber silencieusement sur localhost/postgres
// (ce fallback discret n'est destiné qu'au dev local).
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL manquant en production : renseignez la connection string Neon (cf. render.yaml → lime-backend).",
  );
}

// DATABASE_URL prime (BDD externe) ; sinon variables discrètes pour le dev local.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl }
    : {
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "chat_db",
        ssl,
      },
);

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

export type CanalRole =
  | "canal_owner"
  | "canal_admin"
  | "canal_member"
  | "canal_reader";
const CANAL_ROLE_NAMES: CanalRole[] = [
  "canal_owner",
  "canal_admin",
  "canal_member",
  "canal_reader",
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
                  WHEN 'canal_member' THEN 2
                  ELSE 3 END
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

/** Creates a channel in the caller's org; creator becomes canal_owner. */
export async function createChannel(
  name: string,
  creatorId: number,
  orgId: number,
): Promise<ChannelRow> {
  const ownerRoleId = await getCanalRoleId("canal_owner");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Le canal est créé dans l'org du JWT, après recoupement que le créateur
    // appartient bien à cette org (évite tout désalignement JWT / users.org_id).
    const channel = await client.query(
      `INSERT INTO channels (name, org_id)
       SELECT $1, $3
       WHERE EXISTS (SELECT 1 FROM users WHERE id = $2 AND org_id = $3)
       RETURNING id, name`,
      [name, creatorId, orgId],
    );
    const channelRow = channel.rows[0] as ChannelRow | undefined;
    if (!channelRow) {
      throw new Error(
        "Org mismatch : le créateur n'appartient pas à l'organisation demandée",
      );
    }
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
                  WHEN 'canal_member' THEN 2
                  ELSE 3 END
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
              WHEN 'canal_member' THEN 2
              ELSE 3
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
       WHEN 'canal_member' THEN 2
       ELSE 3 END
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

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export interface OrganisationRow {
  id: number;
  nom: string;
  raison_sociale: string | null;
  siren: string | null;
  siret: string | null;
  tva_intracommunautaire: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays: string | null;
  created_at: string;
  updated_at: string;
}

/** Champs de l'org modifiables via PATCH /api/org (nom inclus, hors identifiants techniques). */
export const ORG_UPDATABLE_FIELDS = [
  "nom",
  "raison_sociale",
  "siren",
  "siret",
  "tva_intracommunautaire",
  "email",
  "telephone",
  "adresse",
  "code_postal",
  "ville",
  "pays",
] as const;

export type OrgUpdatableField = (typeof ORG_UPDATABLE_FIELDS)[number];

/** Returns the organisation row by id, or null. */
export async function getOrganisationById(
  orgId: number,
): Promise<OrganisationRow | null> {
  const result = await pool.query("SELECT * FROM organisations WHERE id = $1", [
    orgId,
  ]);
  return result.rows[0] ?? null;
}

/** Updates the provided org fields (whitelisted) and bumps updated_at. Returns the updated row or null. */
export async function updateOrganisation(
  orgId: number,
  fields: Partial<Record<OrgUpdatableField, string | null>>,
): Promise<OrganisationRow | null> {
  const keys = ORG_UPDATABLE_FIELDS.filter((k) => fields[k] !== undefined);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
  setClauses.push("updated_at = CURRENT_TIMESTAMP");
  const values = keys.map((k) => fields[k]);
  const result = await pool.query(
    `UPDATE organisations SET ${setClauses.join(", ")} WHERE id = $1 RETURNING *`,
    [orgId, ...values],
  );
  return result.rows[0] ?? null;
}

/** Rôles applicables au niveau organisation (scope org_id dans user_roles). */
export type OrgRole = "org_owner" | "org_admin" | "member";
const ORG_ROLE_NAMES: OrgRole[] = ["org_owner", "org_admin", "member"];

/** Returns the caller's org-scoped role (highest priority), or null if none. */
export async function getUserOrgRole(
  userId: number,
  orgId: number,
): Promise<OrgRole | null> {
  const result = await pool.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND ur.org_id = $2 AND r.name = ANY($3::text[])
     ORDER BY CASE r.name
       WHEN 'org_owner' THEN 0
       WHEN 'org_admin' THEN 1
       ELSE 2 END
     LIMIT 1`,
    [userId, orgId, ORG_ROLE_NAMES],
  );
  return (result.rows[0]?.name as OrgRole | undefined) ?? null;
}

export type PermissionAction = "GET" | "CREATE" | "UPDATE" | "DELETE";

export interface PermissionScope {
  orgId: number;
  teamId?: number | null;
  channelId?: number | null;
}

/**
 * RBAC chokepoint : true si l'un des rôles de l'utilisateur — pertinent pour le
 * scope demandé (org, ou team/channel ciblés) — accorde la permission
 * (category, action) via role_permissions. Un rôle org-scopé couvre tout l'org,
 * un rôle team/canal-scopé ne couvre que sa team / son canal.
 */
export async function userHasPermission(
  userId: number,
  category: string,
  action: PermissionAction,
  scope: PermissionScope,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
       AND p.category = $2
       AND p.action = $3::permission_action
       AND (
         ur.org_id = $4
         OR ($5::int IS NOT NULL AND ur.team_id = $5)
         OR ($6::int IS NOT NULL AND ur.channel_id = $6)
       )
     LIMIT 1`,
    [
      userId,
      category,
      action,
      scope.orgId,
      scope.teamId ?? null,
      scope.channelId ?? null,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export interface OrgMember {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  role: OrgRole | null;
  activated: boolean;
}

/** Lists the users of an organisation with their org-scoped role and activation status. */
export async function listOrgMembers(orgId: number): Promise<OrgMember[]> {
  const result = await pool.query(
    `SELECT u.id, u.firstname, u.lastname, u.email, u.username,
       (u.activated_at IS NOT NULL) AS activated,
       (SELECT r.name FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id AND ur.org_id = $1 AND r.name = ANY($2::text[])
         ORDER BY CASE r.name
           WHEN 'org_owner' THEN 0
           WHEN 'org_admin' THEN 1
           ELSE 2 END
         LIMIT 1) AS role
     FROM users u
     WHERE u.org_id = $1
     ORDER BY u.id ASC`,
    [orgId, ORG_ROLE_NAMES],
  );
  return result.rows;
}

/** Postgres unique-violation error code. */
const PG_UNIQUE_VIOLATION = "23505";

export class DuplicateError extends Error {
  constructor(public field: "email" | "username") {
    super(`Duplicate ${field}`);
    this.name = "DuplicateError";
  }
}

/**
 * Creates a new member inside an existing org with the given org role, atomically.
 * The password hash is provided by the caller (random until the user activates).
 * Throws DuplicateError on email/username conflict.
 */
export async function createOrgMember(args: {
  orgId: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  hashedPassword: string;
  role: "org_admin" | "member";
}): Promise<{
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  org_id: number;
}> {
  const roleId = await getRoleId(args.role);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // activated_at = NULL : le membre n'est pas encore actif tant qu'il n'a pas
    // défini son mot de passe via l'email d'invitation.
    const user = await client.query(
      `INSERT INTO users (firstname, lastname, email, username, password, org_id, activated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       RETURNING id, firstname, lastname, email, username, org_id`,
      [
        args.firstname,
        args.lastname,
        args.email,
        args.username,
        args.hashedPassword,
        args.orgId,
      ],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)`,
      [user.rows[0].id, roleId, args.orgId],
    );
    await client.query("COMMIT");
    return user.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      const detail = String((err as { detail?: string }).detail ?? "");
      throw new DuplicateError(
        detail.includes("username") ? "username" : "email",
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Sets the password and marks the account active (used by invitation activation). */
export async function activateUser(
  userId: number,
  hashedPassword: string,
): Promise<boolean> {
  const result = await pool.query(
    "UPDATE users SET password = $1, activated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [hashedPassword, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Changes a member's org role (org_admin or member). Never touches org_owner. Returns false if member not found. */
export async function setOrgMemberRole(
  userId: number,
  orgId: number,
  role: "org_admin" | "member",
): Promise<boolean> {
  const roleId = await getRoleId(role);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inOrg = await client.query(
      "SELECT 1 FROM users WHERE id = $1 AND org_id = $2",
      [userId, orgId],
    );
    if (inOrg.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `DELETE FROM user_roles ur
       USING roles r
       WHERE ur.role_id = r.id AND ur.user_id = $1 AND ur.org_id = $2
         AND r.name = ANY($3::text[])`,
      [userId, orgId, ORG_ROLE_NAMES],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)`,
      [userId, roleId, orgId],
    );
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export type RemoveMemberResult = "removed" | "not_found" | "has_content";

/**
 * Removes a member from the org (= deletes the user, one user/one org).
 * Refuses if the user still owns messages/documents (FK would break) — those
 * must be handled first. Cleans up role/team/channel associations otherwise.
 */
export async function removeOrgMember(
  userId: number,
  orgId: number,
): Promise<RemoveMemberResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inOrg = await client.query(
      "SELECT 1 FROM users WHERE id = $1 AND org_id = $2",
      [userId, orgId],
    );
    if (inOrg.rowCount === 0) {
      await client.query("ROLLBACK");
      return "not_found";
    }
    const content = await client.query(
      `SELECT 1 FROM messages WHERE user_id = $1
       UNION ALL SELECT 1 FROM documents WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if ((content.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return "has_content";
    }
    await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM team_users WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM channel_team_users WHERE user_id = $1", [
      userId,
    ]);
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
    return "removed";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export type TeamRole = "team_owner" | "team_admin" | "team_member";
const TEAM_ROLE_NAMES: TeamRole[] = ["team_owner", "team_admin", "team_member"];

export interface TeamRow {
  id: number;
  name: string;
  org_id: number;
}

/** Lists the teams of an org with their member count. */
export async function listTeams(
  orgId: number,
): Promise<Array<TeamRow & { member_count: number }>> {
  const result = await pool.query(
    `SELECT t.id, t.name, t.org_id,
       (SELECT COUNT(*)::int FROM team_users tu WHERE tu.team_id = t.id) AS member_count
     FROM teams t
     WHERE t.org_id = $1
     ORDER BY t.id ASC`,
    [orgId],
  );
  return result.rows;
}

/**
 * Lists only the teams of an org the given user belongs to (via team_users),
 * with their member count. Utilisé pour les membres simples, qui ne doivent
 * voir que leurs propres équipes.
 */
export async function listTeamsForMember(
  orgId: number,
  userId: number,
): Promise<Array<TeamRow & { member_count: number }>> {
  const result = await pool.query(
    `SELECT t.id, t.name, t.org_id,
       (SELECT COUNT(*)::int FROM team_users tu2 WHERE tu2.team_id = t.id) AS member_count
     FROM teams t
     JOIN team_users tu ON tu.team_id = t.id AND tu.user_id = $2
     WHERE t.org_id = $1
     ORDER BY t.id ASC`,
    [orgId, userId],
  );
  return result.rows;
}

/** Returns a team row scoped to the org, or null. */
export async function getTeamById(
  teamId: number,
  orgId: number,
): Promise<TeamRow | null> {
  const result = await pool.query(
    "SELECT id, name, org_id FROM teams WHERE id = $1 AND org_id = $2",
    [teamId, orgId],
  );
  return result.rows[0] ?? null;
}

/**
 * Creates an empty team in the org. Le créateur (un manager d'org) n'est PAS
 * ajouté à l'équipe : il la gère via ses droits d'org sans en être membre, puis
 * y ajoute les membres et désigne un propriétaire. Le paramètre creatorId sert
 * uniquement à vérifier l'appartenance à l'org demandée.
 */
export async function createTeam(
  orgId: number,
  name: string,
  creatorId: number,
): Promise<TeamRow> {
  const team = await pool.query(
    `INSERT INTO teams (name, org_id)
     SELECT $1, $3
     WHERE EXISTS (SELECT 1 FROM users WHERE id = $2 AND org_id = $3)
     RETURNING id, name, org_id`,
    [name, creatorId, orgId],
  );
  const teamRow = team.rows[0] as TeamRow | undefined;
  if (!teamRow) {
    throw new Error(
      "Org mismatch : le créateur n'appartient pas à l'organisation demandée",
    );
  }
  return teamRow;
}

/** Renames a team within the org; returns the updated row or null. */
export async function renameTeam(
  teamId: number,
  orgId: number,
  name: string,
): Promise<TeamRow | null> {
  const result = await pool.query(
    `UPDATE teams SET name = $1 WHERE id = $2 AND org_id = $3
     RETURNING id, name, org_id`,
    [name, teamId, orgId],
  );
  return result.rows[0] ?? null;
}

/** Deletes a team and its memberships/role rows. Returns false if not found in org. */
export async function deleteTeam(
  teamId: number,
  orgId: number,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query(
      "SELECT 1 FROM teams WHERE id = $1 AND org_id = $2",
      [teamId, orgId],
    );
    if (exists.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("DELETE FROM user_roles WHERE team_id = $1", [teamId]);
    await client.query("DELETE FROM team_users WHERE team_id = $1", [teamId]);
    await client.query("DELETE FROM channel_team_users WHERE team_id = $1", [
      teamId,
    ]);
    await client.query("DELETE FROM teams WHERE id = $1", [teamId]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Vrai si l'utilisateur appartient à la team ET que cette team appartient à
 * l'org donnée. Scopé à l'org pour éviter toute fuite inter-org si l'appelant
 * n'a pas déjà vérifié le couple (teamId, orgId).
 */
export async function isTeamMemberInOrg(
  userId: number,
  teamId: number,
  orgId: number,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM team_users tu
     JOIN teams t ON t.id = tu.team_id
     WHERE tu.user_id = $1 AND tu.team_id = $2 AND t.org_id = $3
     LIMIT 1`,
    [userId, teamId, orgId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Returns the caller's team-scoped role, or null if not a member. */
export async function getUserTeamRole(
  userId: number,
  teamId: number,
): Promise<TeamRole | null> {
  const result = await pool.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND ur.team_id = $2 AND r.name = ANY($3::text[])
     ORDER BY CASE r.name
       WHEN 'team_owner' THEN 0
       WHEN 'team_admin' THEN 1
       ELSE 2 END
     LIMIT 1`,
    [userId, teamId, TEAM_ROLE_NAMES],
  );
  return (result.rows[0]?.name as TeamRole | undefined) ?? null;
}

export interface TeamMember {
  user_id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: TeamRole;
}

/** Lists the members of a team with their team role (default team_member). */
export async function listTeamMembers(teamId: number): Promise<TeamMember[]> {
  const result = await pool.query(
    `SELECT u.id AS user_id, u.username, u.firstname, u.lastname,
       COALESCE(
         (SELECT r.name FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND ur.team_id = $1 AND r.name = ANY($2::text[])
           ORDER BY CASE r.name
             WHEN 'team_owner' THEN 0
             WHEN 'team_admin' THEN 1
             ELSE 2 END
           LIMIT 1),
         'team_member'
       ) AS role
     FROM team_users tu
     JOIN users u ON u.id = tu.user_id
     WHERE tu.team_id = $1
     ORDER BY u.id ASC`,
    [teamId, TEAM_ROLE_NAMES],
  );
  return result.rows;
}

export type AddTeamMemberResult = "added" | "not_in_org" | "already_member";

/** Adds a user (must belong to the org) to a team with the given role. */
export async function addTeamMember(
  teamId: number,
  orgId: number,
  userId: number,
  role: "team_admin" | "team_member",
): Promise<AddTeamMemberResult> {
  const roleId = await getRoleId(role);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inOrg = await client.query(
      "SELECT 1 FROM users WHERE id = $1 AND org_id = $2",
      [userId, orgId],
    );
    if (inOrg.rowCount === 0) {
      await client.query("ROLLBACK");
      return "not_in_org";
    }
    const existing = await client.query(
      "SELECT 1 FROM team_users WHERE team_id = $1 AND user_id = $2",
      [teamId, userId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return "already_member";
    }
    await client.query(
      "INSERT INTO team_users (team_id, user_id) VALUES ($1, $2)",
      [teamId, userId],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, roleId, teamId],
    );
    await client.query("COMMIT");
    return "added";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Removes a user from a team (membership + team-scoped roles). Returns false if not a member. */
export async function removeTeamMember(
  teamId: number,
  userId: number,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM team_users WHERE team_id = $1 AND user_id = $2",
      [teamId, userId],
    );
    await client.query(
      "DELETE FROM user_roles WHERE team_id = $1 AND user_id = $2",
      [teamId, userId],
    );
    await client.query("COMMIT");
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export type SetTeamRoleResult = "updated" | "not_member";

/**
 * Change le rôle team-scopé d'un membre de l'équipe.
 * Propriétaire unique : promouvoir un membre en team_owner rétrograde le(s)
 * propriétaire(s) actuel(s) en team_admin (transfert de propriété).
 * Renvoie "not_member" si l'utilisateur n'appartient pas à l'équipe.
 */
export async function setTeamMemberRole(
  teamId: number,
  userId: number,
  role: TeamRole,
): Promise<SetTeamRoleResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const member = await client.query(
      "SELECT 1 FROM team_users WHERE team_id = $1 AND user_id = $2",
      [teamId, userId],
    );
    if (member.rowCount === 0) {
      await client.query("ROLLBACK");
      return "not_member";
    }
    // Transfert : un seul propriétaire par équipe.
    if (role === "team_owner") {
      const ownerRoleId = await getRoleId("team_owner");
      const adminRoleId = await getRoleId("team_admin");
      await client.query(
        `UPDATE user_roles SET role_id = $1
         WHERE team_id = $2 AND role_id = $3 AND user_id <> $4`,
        [adminRoleId, teamId, ownerRoleId, userId],
      );
    }
    const roleId = await getRoleId(role);
    // Remplace le rôle team-scopé courant du membre par le nouveau.
    await client.query(
      `DELETE FROM user_roles ur
       USING roles r
       WHERE ur.role_id = r.id AND ur.team_id = $1 AND ur.user_id = $2
         AND r.name = ANY($3::text[])`,
      [teamId, userId, TEAM_ROLE_NAMES],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, team_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, roleId, teamId],
    );
    await client.query("COMMIT");
    return "updated";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
