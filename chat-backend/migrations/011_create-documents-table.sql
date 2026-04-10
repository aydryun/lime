-- Up Migration
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  message_id INTEGER NOT NULL REFERENCES messages(id),
  type VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_channel_id ON documents(channel_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_message_id ON documents(message_id);

--- Down Migration
DROP INDEX idx_documents_message_id;
DROP INDEX idx_documents_user_id;
DROP INDEX idx_documents_channel_id;
DROP TABLE documents;
