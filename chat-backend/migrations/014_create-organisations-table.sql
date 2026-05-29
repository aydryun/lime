-- Up Migration
-- L'organisation est la frontière tenant : chaque ressource appartient à exactement une org.

CREATE TABLE organisations (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(255) NOT NULL
);

-- Org par défaut, uniquement s'il y a déjà des données à rattacher (BDD non vide).
INSERT INTO organisations (nom)
  SELECT 'Organisation par défaut'
  WHERE EXISTS (SELECT 1 FROM users)
     OR EXISTS (SELECT 1 FROM teams)
     OR EXISTS (SELECT 1 FROM channels);

-- --- teams.org_id (NOT NULL) ---
ALTER TABLE teams ADD COLUMN org_id INTEGER REFERENCES organisations(id);
UPDATE teams SET org_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
  WHERE org_id IS NULL;
ALTER TABLE teams ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_teams_org_id ON teams(org_id);

-- --- channels.org_id (NOT NULL) ---
ALTER TABLE channels ADD COLUMN org_id INTEGER REFERENCES organisations(id);
UPDATE channels SET org_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
  WHERE org_id IS NULL;
ALTER TABLE channels ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_channels_org_id ON channels(org_id);

-- --- users.org_id (NOT NULL : un compte = une org) ---
ALTER TABLE users ADD COLUMN org_id INTEGER REFERENCES organisations(id);
UPDATE users SET org_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
  WHERE org_id IS NULL;
ALTER TABLE users ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_users_org_id ON users(org_id);

-- --- messages.org_id / documents.org_id (dénormalisé depuis le canal) ---
ALTER TABLE messages ADD COLUMN org_id INTEGER REFERENCES organisations(id);
UPDATE messages m SET org_id = c.org_id FROM channels c WHERE c.id = m.channel_id;
ALTER TABLE messages ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_messages_org_id ON messages(org_id);

ALTER TABLE documents ADD COLUMN org_id INTEGER REFERENCES organisations(id);
UPDATE documents d SET org_id = c.org_id FROM channels c WHERE c.id = d.channel_id;
ALTER TABLE documents ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_documents_org_id ON documents(org_id);

-- --- user_roles.org_id + scope unique ---
ALTER TABLE user_roles ADD COLUMN org_id INTEGER REFERENCES organisations(id);

-- Un rôle est rattaché à au plus un scope : org, team OU channel (jamais deux à la fois).
ALTER TABLE user_roles ADD CONSTRAINT chk_user_roles_single_scope CHECK (
  (CASE WHEN org_id     IS NOT NULL THEN 1 ELSE 0 END
 + CASE WHEN team_id    IS NOT NULL THEN 1 ELSE 0 END
 + CASE WHEN channel_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
);

DROP INDEX idx_user_roles_unique;
CREATE UNIQUE INDEX idx_user_roles_unique
  ON user_roles (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0));

--- Down Migration
DROP INDEX idx_user_roles_unique;
CREATE UNIQUE INDEX idx_user_roles_unique
  ON user_roles (user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0));
ALTER TABLE user_roles DROP CONSTRAINT chk_user_roles_single_scope;
ALTER TABLE user_roles DROP COLUMN org_id;

DROP INDEX idx_documents_org_id;
ALTER TABLE documents DROP COLUMN org_id;
DROP INDEX idx_messages_org_id;
ALTER TABLE messages DROP COLUMN org_id;

DROP INDEX idx_users_org_id;
ALTER TABLE users DROP COLUMN org_id;
DROP INDEX idx_channels_org_id;
ALTER TABLE channels DROP COLUMN org_id;
DROP INDEX idx_teams_org_id;
ALTER TABLE teams DROP COLUMN org_id;

DROP TABLE organisations;
