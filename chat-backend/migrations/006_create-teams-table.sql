-- Up Migration
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

--- Down Migration
DROP TABLE teams;
