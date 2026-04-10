import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "chat_db",
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firstname VARCHAR(255) NOT NULL,
        lastname VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        sender VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on created_at for ordering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages(created_at DESC);
    `);

    console.log("✓ Database schema initialized");
  } finally {
    client.release();
  }
}

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
export async function getAllMessages() {
  const result = await pool.query(
    "SELECT id, sender, text, created_at FROM messages ORDER BY created_at ASC",
  );
  return result.rows;
}

// Insert a message
export async function insertMessage(sender: string, text: string) {
  const result = await pool.query(
    "INSERT INTO messages (sender, text) VALUES ($1, $2) RETURNING id, sender, text, created_at",
    [sender, text],
  );
  return result.rows[0];
}

export default pool;
