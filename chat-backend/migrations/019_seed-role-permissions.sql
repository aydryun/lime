-- Up Migration
-- Branche le RBAC sur les rôles réellement utilisés par l'application. Les seeds
-- de démo ne couvraient que admin/moderator/member ; ici on couvre les rôles
-- scopés (org_*, team_*, canal_*) et on ajoute les catégories org / member.

-- Unicité (category, action) : préalable aux upserts idempotents.
ALTER TABLE permissions
  ADD CONSTRAINT permissions_category_action_unique UNIQUE (category, action);

-- Nouvelles catégories : gestion de l'organisation et de ses membres.
INSERT INTO permissions (category, action) VALUES
  ('org',    'GET'),
  ('org',    'UPDATE'),
  ('member', 'GET'),
  ('member', 'CREATE'),
  ('member', 'UPDATE'),
  ('member', 'DELETE')
ON CONFLICT (category, action) DO NOTHING;

-- org_owner / org_admin : contrôle total sur l'organisation.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('org_owner', 'org_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Rôles scopés team / canal : permissions ciblées.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
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
  ('canal_member', 'message', 'CREATE')
) AS g(role_name, category, action)
JOIN roles r ON r.name = g.role_name
JOIN permissions p
  ON p.category = g.category
 AND p.action = g.action::permission_action
ON CONFLICT (role_id, permission_id) DO NOTHING;

--- Down Migration
DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE category IN ('org', 'member'));

DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN (
    'org_owner', 'org_admin',
    'team_owner', 'team_admin', 'team_member',
    'canal_owner', 'canal_admin', 'canal_member'
  )
);

DELETE FROM permissions WHERE category IN ('org', 'member');

ALTER TABLE permissions DROP CONSTRAINT permissions_category_action_unique;
