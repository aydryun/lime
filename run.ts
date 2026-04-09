import { $ } from "bun";

console.log("=========================================");
console.log("🚀 Lancement du chat moderne...");
console.log("=========================================");

try {
  console.log("\n📦 1. Vérification des services (PostgreSQL et Redis)...");
  console.log("  Lancer le docker compose up");

  console.log("\n🔧 2. Installation des dépendances du backend...");
  await $`cd chat-backend && bun install`;

  console.log("\n🔧 3. Installation des dépendances du client...");
  await $`cd chat-client && bun install`;

  console.log("\n🚀 4. Démarrage du serveur backend (port 3000)...");
  await $`cd chat-backend && bun run dev`;

  console.log("\n🌐 5. Démarrage du serveur frontend (http://localhost:8080)...");
  await $`cd chat-client && bun run index.ts`;

} catch (error) {
  console.error("❌ Erreur:", error);
  console.log("\n💡 Astuces:");
  console.log("   1. Vérifiez que PostgreSQL est en cours d'exécution");
  console.log("   2. Vérifiez que Redis est en cours d'exécution");
  console.log("   3. Vérifiez que les ports 3000 et 8080 sont disponibles");
}
