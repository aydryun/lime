-- Up Migration
-- Rend le RBAC autonome (indépendant de seed.ts) et ajoute le rôle lecture seule.
--
-- Contexte : 019 a fait un CROSS JOIN « toutes les permissions » pour org_owner/
-- org_admin AVANT que les permissions team/channel/message n'existent (elles
-- n'étaient créées que par seed.ts, après coup). Résultat : org_owner n'avait
-- jamais team:GET, d'où le 403 sur GET /api/teams. On crée donc ici toutes les
-- permissions applicatives puis on rejoue les grants, idempotemment.

-- 1. Garantir l'existence de TOUTES les permissions applicatives.
INSERT INTO permissions (category, action) VALUES
  ('team',    'GET'),
  ('team',    'CREATE'),
  ('team',    'UPDATE'),
  ('team',    'DELETE'),
  ('channel', 'GET'),
  ('channel', 'CREATE'),
  ('channel', 'UPDATE'),
  ('channel', 'DELETE'),
  ('message', 'GET'),
  ('message', 'CREATE'),
  ('message', 'UPDATE'),
  ('message', 'DELETE')
ON CONFLICT (category, action) DO NOTHING;

-- 2. Nouveau rôle : lecteur d'un canal (consultation seule).
INSERT INTO roles (name, is_admin, is_super_admin) VALUES
  ('canal_reader', FALSE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- 3. org_owner / org_admin : toutes les permissions (rejoué maintenant que les
--    rows team/channel/message existent).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('org_owner', 'org_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Rôles scopés : team_*, member (lecture des teams de son org), canal_*.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('member',       'team',    'GET'),
  ('team_owner',   'team',    'GET'),
  ('team_owner',   'team',    'UPDATE'),
  ('team_owner',   'team',    'DELETE'),
  ('team_admin',   'team',    'GET'),
  ('team_admin',   'team',    'UPDATE'),
  ('team_member',  'team',    'GET'),
  ('canal_owner',  'channel', 'GET'),
  ('canal_owner',  'channel', 'UPDATE'),
  ('canal_owner',  'channel', 'DELETE'),
  ('canal_owner',  'message', 'GET'),
  ('canal_owner',  'message', 'CREATE'),
  ('canal_owner',  'message', 'UPDATE'),
  ('canal_owner',  'message', 'DELETE'),
  ('canal_admin',  'channel', 'GET'),
  ('canal_admin',  'channel', 'UPDATE'),
  ('canal_admin',  'message', 'GET'),
  ('canal_admin',  'message', 'CREATE'),
  ('canal_admin',  'message', 'UPDATE'),
  ('canal_admin',  'message', 'DELETE'),
  ('canal_member', 'channel', 'GET'),
  ('canal_member', 'message', 'GET'),
  ('canal_member', 'message', 'CREATE'),
  ('canal_reader', 'channel', 'GET'),
  ('canal_reader', 'message', 'GET')
) AS g(role_name, category, action)
JOIN roles r ON r.name = g.role_name
JOIN permissions p
  ON p.category = g.category
 AND p.action = g.action::permission_action
ON CONFLICT (role_id, permission_id) DO NOTHING;

--- Down Migration
-- On retire uniquement ce que cette migration a introduit de spécifique
-- (le rôle canal_reader). Les permissions team/channel/message et les grants
-- org/team/canal sont désormais le socle attendu du RBAC : on les conserve.
DELETE FROM role_permissions rp
USING roles r
WHERE rp.role_id = r.id AND r.name = 'canal_reader';

DELETE FROM user_roles ur
USING roles r
WHERE ur.role_id = r.id AND r.name = 'canal_reader';

DELETE FROM roles WHERE name = 'canal_reader';
