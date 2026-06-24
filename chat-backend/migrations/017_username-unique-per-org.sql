-- Up Migration
-- Plusieurs utilisateurs par org (invitations) : le username n'est plus unique
-- globalement mais au sein d'une même organisation. L'email reste unique global
-- (sert d'identifiant de login et de cible d'invitation).

ALTER TABLE users DROP CONSTRAINT users_username_key;

CREATE UNIQUE INDEX idx_users_username_per_org_unique
  ON users (org_id, username);

--- Down Migration
DROP INDEX idx_users_username_per_org_unique;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
