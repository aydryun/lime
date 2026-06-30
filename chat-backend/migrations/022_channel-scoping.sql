-- Up Migration
-- Scoping des canaux par équipe + rôle par défaut à l'ajout.
--
-- channel_team_users : un lien team peut désormais s'étendre au sous-arbre de la
-- team (include_descendants), et chaque lien porte le rôle attribué par défaut
-- aux membres qui accèdent au canal via lui (default_role_id ; NULL ⇒ canal_member).
ALTER TABLE channel_team_users
  ADD COLUMN include_descendants BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_role_id INTEGER REFERENCES roles(id);

-- Isolation tenant verrouillée au niveau SQL (même approche que la hiérarchie
-- d'équipes) : chaque lien porte son org_id, et des FK composites garantissent
-- que le canal, l'équipe et l'utilisateur liés appartiennent tous à la MÊME
-- organisation. Empêche tout lien inter-org (import, backfill, futur code) qui
-- exposerait un canal aux membres d'un autre tenant. org_id NOT NULL (un lien
-- appartient toujours à un canal, lequel a un org_id NOT NULL) ; on backfille
-- depuis channels avant de poser la contrainte.
ALTER TABLE channel_team_users ADD COLUMN org_id INTEGER;
UPDATE channel_team_users ctu
  SET org_id = c.org_id FROM channels c WHERE c.id = ctu.channel_id;
ALTER TABLE channel_team_users ALTER COLUMN org_id SET NOT NULL;

-- Index uniques nécessaires aux FK composites (teams a déjà teams_id_org_unique).
ALTER TABLE channels ADD CONSTRAINT channels_id_org_unique UNIQUE (id, org_id);
ALTER TABLE users ADD CONSTRAINT users_id_org_unique UNIQUE (id, org_id);

ALTER TABLE channel_team_users
  ADD CONSTRAINT ctu_channel_same_org_fk
    FOREIGN KEY (channel_id, org_id) REFERENCES channels (id, org_id),
  ADD CONSTRAINT ctu_team_same_org_fk
    FOREIGN KEY (team_id, org_id) REFERENCES teams (id, org_id),
  ADD CONSTRAINT ctu_user_same_org_fk
    FOREIGN KEY (user_id, org_id) REFERENCES users (id, org_id);

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
ALTER TABLE channel_team_users
  DROP CONSTRAINT IF EXISTS ctu_user_same_org_fk,
  DROP CONSTRAINT IF EXISTS ctu_team_same_org_fk,
  DROP CONSTRAINT IF EXISTS ctu_channel_same_org_fk;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_org_unique;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_id_org_unique;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.name IN ('team_owner', 'team_admin')
  AND p.category = 'channel' AND p.action = 'CREATE';

ALTER TABLE channels
  DROP COLUMN IF EXISTS default_role_id,
  DROP COLUMN IF EXISTS is_org_wide;

ALTER TABLE channel_team_users
  DROP COLUMN IF EXISTS org_id,
  DROP COLUMN IF EXISTS default_role_id,
  DROP COLUMN IF EXISTS include_descendants;
