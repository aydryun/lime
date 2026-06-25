-- Up Migration
-- Statut d'activation d'un compte. Par défaut un compte est actif (inscription,
-- seed) ; un membre invité est créé avec activated_at = NULL et l'active en
-- définissant son mot de passe via l'email d'invitation.

ALTER TABLE users ADD COLUMN activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

--- Down Migration
ALTER TABLE users DROP COLUMN activated_at;
