import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "chat_db",
});

// Find user by email
export async function findUserByEmail(email: string) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

// Find user by id
export async function findUserById(id: number) {
  const result = await pool.query(
    "SELECT id, firstname, lastname, email, username FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0] || null;
}

// Create user
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

// Get all messages
export async function getAllMessages(): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT m.id, m.sender_id, u.username AS sender, m.text, m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     ORDER BY m.created_at ASC`,
  );
  return result.rows;
}

// Insert a message
export async function insertMessage(senderId: number, text: string) {
  const result = await pool.query(
    `INSERT INTO messages (sender_id, text) VALUES ($1, $2)
     RETURNING id, sender_id, text, created_at`,
    [senderId, text],
  );
  return result.rows[0];
}

export default pool;
