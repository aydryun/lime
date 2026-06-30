-- Up Migration
-- Scoping des canaux par équipe + rôle par défaut à l'ajout.
--
-- channel_team_users : un lien team peut désormais s'étendre au sous-arbre de la
-- team (include_descendants), et chaque lien porte le rôle attribué par défaut
-- aux membres qui accèdent au canal via lui (default_role_id ; NULL ⇒ canal_member).
ALTER TABLE channel_team_users
  ADD COLUMN include_descendants BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_role_id INTEGER REFERENCES roles(id);

-- channels : un canal peut couvrir toute l'organisation (mode réservé aux
-- managers d'org), avec son propre rôle par défaut.
ALTER TABLE channels
  ADD COLUMN is_org_wide BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_role_id INTEGER REFERENCES roles(id);

-- Un team_owner / team_admin peut créer des canaux scopés à son équipe.
-- La portée (sur quelle team) est vérifiée par userHasPermission (cascade).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('team_owner', 'channel', 'CREATE'),
  ('team_admin', 'channel', 'CREATE')
) AS g(role_name, category, action)
JOIN roles r ON r.name = g.role_name
JOIN permissions p
  ON p.category = g.category
 AND p.action = g.action::permission_action
ON CONFLICT (role_id, permission_id) DO NOTHING;

--- Down Migration
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.name IN ('team_owner', 'team_admin')
  AND p.category = 'channel' AND p.action = 'CREATE';

ALTER TABLE channels
  DROP COLUMN IF EXISTS default_role_id,
  DROP COLUMN IF EXISTS is_org_wide;

ALTER TABLE channel_team_users
  DROP COLUMN IF EXISTS default_role_id,
  DROP COLUMN IF EXISTS include_descendants;
