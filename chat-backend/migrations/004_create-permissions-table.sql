-- Up Migration
CREATE TYPE permission_action AS ENUM ('GET', 'CREATE', 'UPDATE', 'DELETE');

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  category VARCHAR(255),
  action permission_action DEFAULT 'GET'
);

--- Down Migration
DROP TABLE permissions;
DROP TYPE permission_action;
