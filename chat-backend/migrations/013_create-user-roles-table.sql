-- Up Migration
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_id INTEGER NOT NULL REFERENCES roles(id),
  team_id INTEGER REFERENCES teams(id),
  channel_id INTEGER REFERENCES channels(id)
);

-- Empêcher les doublons (même user + même rôle + même scope)
CREATE UNIQUE INDEX idx_user_roles_unique
  ON user_roles (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0));

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

--- Down Migration
DROP INDEX idx_user_roles_role_id;
DROP INDEX idx_user_roles_user_id;
DROP INDEX idx_user_roles_unique;
DROP TABLE user_roles;
