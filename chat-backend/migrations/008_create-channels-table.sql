-- Up Migration
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

--- Down Migration
DROP TABLE channels;
