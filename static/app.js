// I2PChat client — talks to the websocket exposed by the I2P router.
const ROUTER_WS = document.body.dataset.routerWs || "ws://127.0.0.1:9098";

const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const nickInput = document.getElementById("nick-input");
const messages = document.getElementById("messages");
const peersList = document.getElementById("peers");
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");
const routerUrl = document.getElementById("router-url");
const latencyEl = document.getElementById("latency");
const tunnelsEl = document.getElementById("tunnels");
const reconnectBtn = document.getElementById("reconnect-btn");

routerUrl.textContent = ROUTER_WS;

let ws = null;
let peers = new Map();
let pingTimer = null;
let lastPingAt = 0;

function setStatus(state, text) {
  connText.textContent = text;
  connDot.style.background = state === "up" ? "#3ddc84" : state === "retry" ? "#ffb020" : "#ff5252";
}

function addMessage(from, text, cls = "") {
  const div = document.createElement("div");
  div.className = "msg " + cls;
  const time = new Date().toLocaleTimeString();
  const b = document.createElement("b");
  b.textContent = from;
  div.appendChild(b);
  div.appendChild(document.createTextNode(` [${time}]: ${text}`));
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function renderPeers() {
  peersList.innerHTML = "";
  if (peers.size === 0) {
    peersList.innerHTML = "<li><i>No peers yet</i></li>";
    return;
  }
  for (const [nick, info] of peers) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot small";
    li.appendChild(dot);
    li.appendChild(document.createTextNode(" " + nick));
    if (info.typing) {
      const t = document.createElement("em");
      t.textContent = " typing…";
      li.appendChild(t);
    }
    peersList.appendChild(li);
  }
}

function send(event) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
    return true;
  }
  addMessage("system", "Not connected to router — message dropped.", "sys");
  return false;
}

function connect() {
  if (ws) { try { ws.close(); } catch (_) {} }
  setStatus("retry", "Connecting…");
  addMessage("system", `Dialing router websocket ${ROUTER_WS}…`, "sys");

  ws = new WebSocket(ROUTER_WS);

  ws.onopen = () => {
    setStatus("up", "Connected");
    addMessage("system", "Router link established. Say hello.", "sys");
    send({ type: "hello", nick: nickInput.value.trim() || "anon", client: "i2pchat-web/1.0" });
    lastPingAt = Date.now();
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      lastPingAt = Date.now();
      send({ type: "ping", at: lastPingAt });
    }, 15000);
  };

  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); }
    catch (_) { addMessage("router", String(ev.data)); return; }
    onRouterEvent(msg);
  };

  ws.onerror = () => {
    setStatus("down", "Router error");
    addMessage("system", "Websocket error — is the I2P router running with WS on 9098?", "sys err");
  };

  ws.onclose = () => {
    setStatus("down", "Disconnected");
    clearInterval(pingTimer);
    addMessage("system", "Router connection closed. Retrying in 3s…", "sys");
    setTimeout(connect, 3000);
  };
}

function onRouterEvent(msg) {
  switch (msg.type) {
    case "welcome":
      addMessage("system", msg.text || "Welcome to I2PChat.", "sys");
      if (msg.tunnels) tunnelsEl.textContent = msg.tunnels;
      break;
    case "message":
      addMessage(msg.from || "anon", msg.text || "");
      break;
    case "peer-join":
      peers.set(msg.nick, { typing: false });
      renderPeers();
      addMessage("system", `${msg.nick} joined.`, "sys");
      break;
    case "peer-leave":
      peers.delete(msg.nick);
      renderPeers();
      addMessage("system", `${msg.nick} left.`, "sys");
      break;
    case "peers":
      peers = new Map((msg.nicks || []).map((n) => [n, { typing: false }]));
      renderPeers();
      break;
    case "typing":
      if (peers.has(msg.nick)) {
        peers.get(msg.nick).typing = !!msg.on;
        renderPeers();
      }
      break;
    case "pong":
      latencyEl.textContent = `${Date.now() - (msg.at || lastPingAt)} ms`;
      break;
    case "router-stats":
      if (msg.tunnels) tunnelsEl.textContent = msg.tunnels;
      if (msg.latencyMs != null) latencyEl.textContent = `${msg.latencyMs} ms`;
      break;
    case "error":
      addMessage("system", `Router error: ${msg.error || "unknown"}`, "sys err");
      break;
    default:
      addMessage("router", JSON.stringify(msg));
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const nick = nickInput.value.trim() || "anon";
  if (send({ type: "message", from: nick, channel: "#general", text })) {
    addMessage(nick + " (you)", text, "mine");
  }
  input.value = "";
});

let typingTimer = null;
input.addEventListener("input", () => {
  send({ type: "typing", nick: nickInput.value.trim() || "anon", on: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => send({ type: "typing", nick: nickInput.value.trim() || "anon", on: false }), 1200);
});

nickInput.addEventListener("change", () => {
  send({ type: "nick", nick: nickInput.value.trim() || "anon" });
});

reconnectBtn.addEventListener("click", connect);

renderPeers();
connect();
