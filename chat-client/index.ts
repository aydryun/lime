import { serve } from "bun";

// Une toute petite page HTML très simple pour notre chat
const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Chat Minimaliste SpacetimeDB</title>
    <style>
        body { font-family: sans-serif; background: #222; color: #fff; padding: 20px; }
        #chat { width: 100%; height: 400px; background: #333; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
        input { padding: 10px; width: calc(100% - 100px); }
        button { padding: 10px; width: 80px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Chat en Direct 🚀</h1>
    <div id="chat"></div> <!-- Les messages vont apparaître ici -->
    <input type="text" id="input" placeholder="Écris ton message...">
    <button id="btn">Envoyer</button>
    <script type="module" src="/app.js"></script>
</body>
</html>
`;

// Le serveur web "Bun"
serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    // On compile et on sert notre script client.ts à la volée !
    if (url.pathname === "/app.js") {
      const build = await Bun.build({ entrypoints: ["./src/client.ts"], format: "esm" });
      if (build.success) {
        return new Response(build.outputs[0].stream(), { headers: { "Content-Type": "application/javascript" } });
      }
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log("🌐 Ouvre ton navigateur sur http://localhost:8080");
console.log("Appuie sur CTRL+C pour arrêter le serveur.");
