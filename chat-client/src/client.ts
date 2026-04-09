import { DbConnection, tables } from "./module_bindings/index";

// 1. On demande un pseudo très bêtement
const pseudo = prompt("Choisis un pseudo pour le chat :") || "Anonyme";

// 2. LA CONNEXION À SPACETIMEDB (Notre base en direct)
const conn = DbConnection.builder()
  .withUri("ws://localhost:3000") // Adresse du serveur local SpacetimeDB
  .withDatabaseName("chat-backend")
  .onConnect((connection) => {
    console.log("🟢 Connecté à SpacetimeDB !");
    
    // On s'abonne pour recevoir en direct le contenu de la table "message"
    connection.subscriptionBuilder()
      .subscribe(['SELECT * FROM message']);
  })
  .build();

// ==========================================
// 3. L'AFFICHAGE DU CHAT (Temps réel)
// ==========================================
const chatDiv = document.getElementById("chat");

// À chaque fois qu'un message est ajouté dans la base de données...
conn.db.message.onInsert((ctx, msg) => {
  // On ajoute bêtement une ligne au div
  chatDiv.innerHTML += `<div><b>${msg.sender}</b> : ${msg.text}</div>`;
  // On scrolle tout en bas
  chatDiv.scrollTop = chatDiv.scrollHeight;
});


// ==========================================
// 4. L'ENVOI D'UN MESSAGE
// ==========================================
const input = document.getElementById("input") as HTMLInputElement;
const btn = document.getElementById("btn");

btn.addEventListener("click", () => {
  const texte = input.value.trim();
  if (texte) {
    // On demande à la base d'exécuter la fonction "sendMessage" !
    // Remarque : SpaceTimeDB a généré ça en camelCase.
    conn.reducers.sendMessage({ sender: pseudo, text: texte });
    
    // On vide la case
    input.value = "";
  }
});

// Pareil avec la touche "Entrée"
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btn.click();
});
