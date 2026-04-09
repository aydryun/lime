import { $ } from "bun";

console.log("=========================================");
console.log("🚀 Lancement du prototype ultra-simple...");
console.log("=========================================");

try {
  console.log("\n📦 1. Publication du Backend (On détruit l'ancienne base avec -c always)...");
  // -c always permet d'effacer les vieilles données car on a supprimé des trucs
  await $`spacetime publish chat-backend --delete-data=always -s local --module-path chat-backend/spacetimedb -y`;

  console.log("🔗 2. Génération du client TypeScript...");
  await $`spacetime generate --lang typescript --out-dir chat-client/src/module_bindings --module-path chat-backend/spacetimedb`;

  console.log("\n🌐 3. Démarrage du serveur Frontend...");
  await $`cd chat-client && bun run index.ts`;

} catch (error) {
  console.error("❌ Oups:", error);
}
