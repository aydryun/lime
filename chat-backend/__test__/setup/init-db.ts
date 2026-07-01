import { $ } from "bun";
import { seed } from "../../seed.js";
import pool from "../../src/database.js";

// Fixtures partagées avec les tests e2e (ids + identifiants), écrites à chaque
// préparation de la BDD et lues par __test__/e2e/helpers.ts.
const FIXTURES_PATH = new URL("../fixtures.json", import.meta.url).pathname;

/**
 * Prépare la BDD de test : applique les migrations, sème un jeu de données
 * déterministe (reset), puis persiste les ids dans fixtures.json. Ne contient
 * aucune donnée métier — celle-ci vit dans seed.ts (source unique).
 */
async function initDb() {
  await $`node-pg-migrate up`.quiet();
  const fixtures = await seed({ reset: true });
  await Bun.write(FIXTURES_PATH, `${JSON.stringify(fixtures, null, 2)}\n`);
}

initDb()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
