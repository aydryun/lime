import { $ } from "bun";

console.log("1. Préparation de la BDD.");
await $`bun __test__/setup/init-db.ts`;

console.log("2. Lancement de l'API");
const server = Bun.spawn(["bun", "src/index.ts"], {
  stdout: "ignore",
});

/**
 * Verifie l'état de l'api avant de passer les tests
 * 5x tout les 100ms
 * Quand api est up -> on passe a la suite (break;)
 */
for (let index = 0; index < 5; index++) {
  try {
    await fetch(`http://localhost:${process.env.CHAT_PORT}/api/docs`);
    break;
  } catch {
    await Bun.sleep(100);
  }
}

console.log("3. Lancement des tests E2E...\n");

const { exitCode } = await $`bun test __test__/e2e`.nothrow();

console.log("4. Arrêt du serveur...");
server.kill();
process.exit(exitCode);
