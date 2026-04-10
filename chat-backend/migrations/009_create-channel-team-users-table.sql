-- Up Migration
CREATE TABLE channel_team_users (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  team_id INTEGER REFERENCES teams(id),
  user_id INTEGER REFERENCES users(id),
  CONSTRAINT chk_team_or_user CHECK (team_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Un channel ne peut être lié qu'une fois à une team
CREATE UNIQUE INDEX idx_channel_team_unique
  ON channel_team_users (channel_id, team_id) WHERE team_id IS NOT NULL;

-- Un channel ne peut être lié qu'une fois à un user
CREATE UNIQUE INDEX idx_channel_user_unique
  ON channel_team_users (channel_id, user_id) WHERE user_id IS NOT NULL;

--- Down Migration
DROP INDEX idx_channel_user_unique;
DROP INDEX idx_channel_team_unique;
DROP TABLE channel_team_users;
