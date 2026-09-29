import { API_ORIGIN, sessionToken } from "./api.mjs";
const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
let socket = null;
let me = null;
let unread = 0;

function isOpen() { return !$("chatWindow").hidden; }
function setUnread(n) {
  unread = Math.max(0, n);
  $("chatFabBadge").hidden = unread === 0;
  $("chatFabBadge").textContent = unread > 99 ? "99+" : String(unread);
}
$("chatFab").onclick = () => {
  $("chatWindow").hidden = false;
  setUnread(0);
  $("chatInput").focus();
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
};
$("chatClose").onclick = () => { $("chatWindow").hidden = true; };
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isOpen()) { $("chatWindow").hidden = true; $("chatFab").focus(); }
});

export function updateChat(user) {
  me = user;
  $("bombStart").disabled = true;
  $("bombGuess").disabled = true;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  if (user) {
    $("chatInput").disabled = false;
    $("chatSend").disabled = false;
    $("chatInput").placeholder = "说点什么…";
    $("chatStatus").textContent = "连接中…";
    connectAuthed();
    return;
  }
  // 匿名留言模式：可发消息，回复只有自己可见（AI 小助手私聊）
  $("chatInput").disabled = false;
  $("chatSend").disabled = false;
  $("chatInput").placeholder = "匿名留言，小助手会回复你…";
  $("chatStatus").textContent = "匿名留言模式";
  $("chatLog").replaceChildren(el("div", "chat-system", "登录后可进入聊天室；匿名留言只有你和 AI 小助手能看到"));
  connectGuest();
}

function connectAuthed() {
  const token = sessionToken();
  if (!token) return;
  openSocket("/api/chat/ws?token=" + token);
}
function connectGuest() {
  openSocket("/api/chat/ws");
}
function openSocket(path) {
  const wsUrl = API_ORIGIN.replace(/^https/, "wss") + path;
  socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    try { handle(JSON.parse(event.data)); } catch { /* 忽略坏消息 */ }
  };
  socket.onopen = () => {
    $("chatStatus").textContent = me ? `已连接 · ${me.name || me.email}` : "匿名留言模式";
  };
  socket.onclose = () => {
    $("chatStatus").textContent = "连接断开，正在重连…";
    setTimeout(() => {
      if (!socket || socket.readyState > 1) {
        if (me) connectAuthed();
        else connectGuest();
      }
    }, 3000);
  };
}

function addLine(node) {
  $("chatLog").append(node);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function renderChat(m) {
  // Ask AI 风格：自己的消息右侧高亮气泡，小助手/他人左侧带名字
  const own = me && m.user !== "小助手" && m.user === (me.name || me.email);
  const bubble = el("div", `chat-msg${own ? " own" : ""}${m.user === "小助手" ? " assistant" : ""}`);
  if (!own) bubble.append(el("span", "chat-user", m.user));
  const body = el("div", "chat-bubble", m.text);
  bubble.append(body, el("span", "chat-time", fmtTime(m.ts)));
  addLine(bubble);
}
function renderSystem(text) {
  addLine(el("div", "chat-system", text));
}
function renderGame(game, by) {
  if (!game) {
    $("bombRange").textContent = "未开局";
    $("bombStatus").textContent = "";
    return;
  }
  $("bombRange").textContent = game.over ? "本局结束" : `${game.min} ~ ${game.max}`;
  if (by) $("bombStatus").textContent = `${by} 猜了，区间收窄到 ${game.min}~${game.max}`;
}
function renderBoom(data) {
  $("bombRange").textContent = `本局结束 · ${data.number}`;
  $("bombStatus").textContent = `💥 ${data.winner} 踩中了炸弹！点「开局」再来一局`;
  renderSystem(`💥 ${data.winner} 踩中数字 ${data.number}`);
}

function handle(data) {
  if (data.type === "history") {
    $("chatLog").replaceChildren();
    for (const m of data.messages || []) renderChat(m);
    renderGame(data.game);
    if (me) {
      $("bombStart").disabled = false;
      $("bombGuess").disabled = false;
    }
    return;
  }
  if (data.type === "chat") {
    renderChat(data.message);
    if (!isOpen()) setUnread(unread + 1);
  }
  if (data.type === "system") renderSystem(data.text);
  if (data.type === "presence") {
    $("chatPresence").textContent = data.count ? `在线 ${data.count} 人` : "";
  }
  if (data.type === "bomb") {
    if (data.event === "start" || data.event === "guess") renderGame(data.game, data.by);
    if (data.event === "boom") renderBoom(data);
    if (data.event === "error") $("bombStatus").textContent = data.text;
  }
}

$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("chatInput").value.trim();
  if (!text || !socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "chat", text }));
  $("chatInput").value = "";
  // 游客消息不会被回显，本地补一条，AI 回复随后到达
  if (!me) renderChat({ user: "我", text, ts: Date.now() });
};
$("bombStart").onclick = () => {
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: "bomb-start" }));
};
$("bombGuess").onkeydown = (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const value = $("bombGuess").value.trim();
  if (!value || !socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "bomb-guess", value }));
  $("bombGuess").value = "";
};
