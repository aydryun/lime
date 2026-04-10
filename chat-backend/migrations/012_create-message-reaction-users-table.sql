-- Up Migration
CREATE TABLE message_reaction_users (
  message_id INTEGER NOT NULL REFERENCES messages(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reaction VARCHAR(255) NOT NULL,
  PRIMARY KEY (message_id, user_id, reaction)
);

--- Down Migration
DROP TABLE message_reaction_users;
