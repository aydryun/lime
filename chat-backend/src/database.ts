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

/** Inserts a new user and returns its public profile. */
export async function createUser(
  firstname: string,
  lastname: string,
  email: string,
  username: string,
  hashedPassword: string,
) {
  const result = await pool.query(
    `INSERT INTO users (firstname, lastname, email, username, password)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, firstname, lastname, email, username`,
    [firstname, lastname, email, username, hashedPassword],
  );
  return result.rows[0];
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

/** Returns every message with its sender's username, ordered by creation time. */
export async function getAllMessages(): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT m.id, m.sender_id, u.username AS sender, m.text, m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     ORDER BY m.created_at ASC`,
  );
  return result.rows;
}

/** Inserts a new message and returns the persisted row. */
export async function insertMessage(senderId: number, text: string) {
  const result = await pool.query(
    `INSERT INTO messages (sender_id, text) VALUES ($1, $2)
     RETURNING id, sender_id, text, created_at`,
    [senderId, text],
  );
  return result.rows[0];
}

export default pool;
