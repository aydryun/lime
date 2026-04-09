import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chat_db',
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
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

    console.log('✓ Database schema initialized');
  } finally {
    client.release();
  }
}

// Get all messages
export async function getAllMessages() {
  const result = await pool.query(
    'SELECT id, sender, text, created_at FROM messages ORDER BY created_at ASC'
  );
  return result.rows;
}

// Insert a message
export async function insertMessage(sender: string, text: string) {
  const result = await pool.query(
    'INSERT INTO messages (sender, text) VALUES ($1, $2) RETURNING id, sender, text, created_at',
    [sender, text]
  );
  return result.rows[0];
}

export default pool;
