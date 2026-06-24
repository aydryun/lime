-- Up Migration
-- Infos légales/contact de l'entreprise sur l'organisation.
-- Tout est nullable (sauf `nom` déjà NOT NULL) pour ne pas casser l'inscription :
-- les champs sont renseignés ensuite via la page de paramètres de l'org.

ALTER TABLE organisations
  ADD COLUMN raison_sociale          VARCHAR(255),
  ADD COLUMN siren                   VARCHAR(9),
  ADD COLUMN siret                   VARCHAR(14),
  ADD COLUMN tva_intracommunautaire  VARCHAR(13),
  ADD COLUMN email                   VARCHAR(255),
  ADD COLUMN telephone               VARCHAR(32),
  ADD COLUMN adresse                 VARCHAR(255),
  ADD COLUMN code_postal             VARCHAR(16),
  ADD COLUMN ville                   VARCHAR(255),
  ADD COLUMN pays                    VARCHAR(255),
  ADD COLUMN created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Unicité « quand renseigné » : un SIREN (entité légale) et un email de contact
-- ne peuvent identifier qu'une seule org, mais restent facultatifs.
CREATE UNIQUE INDEX idx_organisations_siren_unique
  ON organisations (siren) WHERE siren IS NOT NULL;
CREATE UNIQUE INDEX idx_organisations_email_unique
  ON organisations (email) WHERE email IS NOT NULL;

--- Down Migration
DROP INDEX idx_organisations_email_unique;
DROP INDEX idx_organisations_siren_unique;
ALTER TABLE organisations
  DROP COLUMN updated_at,
  DROP COLUMN created_at,
  DROP COLUMN pays,
  DROP COLUMN ville,
  DROP COLUMN code_postal,
  DROP COLUMN adresse,
  DROP COLUMN telephone,
  DROP COLUMN email,
  DROP COLUMN tva_intracommunautaire,
  DROP COLUMN siret,
  DROP COLUMN siren,
  DROP COLUMN raison_sociale;
