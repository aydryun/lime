-- Up Migration
-- Hiérarchie d'équipes : une team peut avoir une team parente (NULL = racine).
-- C'est l'unique source de la hiérarchie (pas de colonne `level` → on évite la
-- redondance et l'usurpation de niveau).
ALTER TABLE teams
  ADD COLUMN parent_team_id INTEGER;

-- Invariant tenant verrouillé au niveau SQL : un parent doit exister ET
-- appartenir à la MÊME organisation que l'enfant. On l'impose via une FK
-- composite (parent_team_id, org_id) → (id, org_id) plutôt qu'une simple FK
-- vers teams(id). Sans ça, un lien parent inter-org introduit par un import, un
-- backfill ou du futur code ferait cascader l'autorité RBAC entre tenants
-- (les CTE remontent parent_team_id). parent_team_id NULL (racine) reste
-- accepté : en MATCH SIMPLE une FK composite avec une colonne NULL n'est pas
-- vérifiée. FK volontairement SANS `ON DELETE` : la suppression d'un parent
-- réattache ses enfants au grand-parent en logique applicative (deleteTeam).
ALTER TABLE teams ADD CONSTRAINT teams_id_org_unique UNIQUE (id, org_id);
ALTER TABLE teams
  ADD CONSTRAINT teams_parent_same_org_fk
  FOREIGN KEY (parent_team_id, org_id) REFERENCES teams (id, org_id);

CREATE INDEX idx_teams_parent_team_id ON teams(parent_team_id);

-- Cascade d'autorité : un team_owner / team_admin peut créer des sous-équipes.
-- On leur accorde team:CREATE ; la portée (sur quelle team parent) est vérifiée
-- par userHasPermission, qui remonte la chaîne parent_team_id.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('team_owner', 'team', 'CREATE'),
  ('team_admin', 'team', 'CREATE')
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
  AND p.category = 'team' AND p.action = 'CREATE';

DROP INDEX IF EXISTS idx_teams_parent_team_id;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_parent_same_org_fk;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_id_org_unique;
ALTER TABLE teams DROP COLUMN parent_team_id;
