-- Up Migration
-- Garantit l'existence des rôles utilisés par le code applicatif (inscription =>
-- org_owner, création de canal => canal_*), indépendamment du seed de démo.

-- Nom de rôle unique (préalable à l'upsert idempotent).
ALTER TABLE roles ADD CONSTRAINT roles_name_unique UNIQUE (name);

INSERT INTO roles (name, is_admin, is_super_admin) VALUES
  ('admin',        TRUE,  TRUE),
  ('moderator',    TRUE,  FALSE),
  ('member',       FALSE, FALSE),
  ('team_owner',   TRUE,  FALSE),
  ('team_admin',   TRUE,  FALSE),
  ('team_member',  FALSE, FALSE),
  ('org_owner',    TRUE,  FALSE),
  ('org_admin',    TRUE,  FALSE),
  ('canal_owner',  TRUE,  FALSE),
  ('canal_admin',  TRUE,  FALSE),
  ('canal_member', FALSE, FALSE)
ON CONFLICT (name) DO NOTHING;

--- Down Migration
ALTER TABLE roles DROP CONSTRAINT roles_name_unique;
