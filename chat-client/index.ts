import { serve } from "bun";

// Une toute petite page HTML très simple pour notre chat
const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Chat Minimaliste</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: sans-serif;
            background-color: #ffffff;
            color: #666;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .app {
            width: 100%;
            max-width: 1000px;
            height: 90vh;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }
        .header {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #888;
        }
        .main-layout {
            display: flex;
            flex: 1;
            gap: 20px;
            overflow: hidden;
        }
        .sidebar {
            width: 80px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .sidebar-items {
            background-color: #f0f0f0;
            border-radius: 12px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
            margin-bottom: 20px;
        }
        .sidebar-item {
            height: 20px;
            background-color: #e0e0e0;
            border-radius: 6px;
        }
        .sidebar-bottom {
            background-color: #b0b0b0;
            color: white;
            border-radius: 12px;
            height: 60px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: bold;
            font-size: 18px;
        }
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 20px;
            overflow: hidden;
        }
        .chat-messages {
            flex: 1;
            background-color: #f5f5f5;
            border-radius: 12px;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .chat-input-area {
            display: flex;
            gap: 10px;
            height: 60px;
        }
        .btn-icon {
            width: 60px;
            border-radius: 12px;
            border: none;
            background-color: #f5f5f5;
            color: #ccc;
            font-size: 32px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #input {
            flex: 1;
            border-radius: 12px;
            border: none;
            background-color: #f5f5f5;
            padding: 0 20px;
            font-size: 16px;
            outline: none;
            color: #666;
        }
        .btn-send {
            width: 60px;
            border-radius: 12px;
            border: none;
            background-color: #b0b0b0;
            color: white;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        /* Styles pour les messages ajoutés par client.ts */
        .message-row {
            display: flex;
            gap: 15px;
        }
        .avatar {
            width: 40px;
            height: 40px;
            background-color: #e0e0e0;
            border-radius: 8px;
            flex-shrink: 0;
        }
        .message-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            background-color: transparent;
            color: #555;
            max-width: 80%;
        }
        .message-text {
            background-color: #e0e0e0;
            border-radius: 10px;
            padding: 10px 15px;
            margin-top: 5px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="app">
        <div class="header">Conversation</div>
        <div class="main-layout">
            <div class="sidebar">
                <div class="sidebar-items">
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                    <div class="sidebar-item"></div>
                </div>
                <div class="sidebar-bottom">G | P</div>
            </div>
            <div class="chat-container">
                <div class="chat-messages" id="chat"></div>
                <div class="chat-input-area">
                    <button class="btn-icon" id="btn-plus">+</button>
                    <input type="text" id="input" placeholder="">
                    <button class="btn-send" id="btn">S</button>
                </div>
            </div>
        </div>
    </div>
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
