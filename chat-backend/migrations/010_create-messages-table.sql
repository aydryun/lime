-- Up Migration
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT,
  is_updated BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

--- Down Migration
DROP INDEX idx_messages_created_at;
DROP INDEX idx_messages_user_id;
DROP INDEX idx_messages_channel_id;
DROP TABLE messages;
