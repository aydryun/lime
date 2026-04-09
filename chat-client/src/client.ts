// Get pseudonym
const pseudo = prompt("Choisis un pseudo pour le chat :") || "Anonyme";

// Connect to WebSocket
const wsUrl = `ws://${window.location.hostname}:3000/ws`;
const ws = new WebSocket(wsUrl);

// Get DOM elements
const chatDiv = document.getElementById("chat")!;
const input = document.getElementById("input") as HTMLInputElement;
const btn = document.getElementById("btn");

// Handle WebSocket connection
ws.onopen = () => {
  console.log("🟢 Connected to server");
};

// Handle incoming messages
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);

    if (msg.type === "initial_messages") {
      // Load initial messages on connect
      msg.data.forEach((message: any) => {
        addMessageToChat(message.sender, message.text);
      });
    } else if (msg.type === "new_message") {
      // Add new message from Redis broadcast
      addMessageToChat(msg.data.sender, msg.data.text);
    } else if (msg.type === "error") {
      console.error("Server error:", msg.data);
      alert("Error: " + msg.data);
    }
  } catch (error) {
    console.error("Failed to parse message:", error);
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("🔴 Disconnected from server");
};

// Helper function to add message to chat
function addMessageToChat(sender: string, text: string) {
  const messageHtml = `
    <div class="message-row">
      <div class="avatar"></div>
      <div class="message-content">
        <b>${escapeHtml(sender)}</b>
        <div class="message-text">${escapeHtml(text)}</div>
      </div>
    </div>
  `;
  chatDiv.innerHTML += messageHtml;
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Handle send button click
btn?.addEventListener("click", () => {
  const texte = input.value.trim();
  if (texte && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "send_message",
        data: {
          sender: pseudo,
          text: texte,
        },
      })
    );
    input.value = "";
  }
});

// Handle Enter key
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    btn?.click();
  }
});

