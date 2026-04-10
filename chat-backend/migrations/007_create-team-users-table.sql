-- Up Migration
CREATE TABLE team_users (
  team_id INTEGER NOT NULL REFERENCES teams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (team_id, user_id)
);

--- Down Migration
DROP TABLE team_users;
