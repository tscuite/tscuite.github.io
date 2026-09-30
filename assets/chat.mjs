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
  $("chatFab").classList.toggle("unread", unread > 0);
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
    $("aiToggleWrap").hidden = false;
    connectAuthed();
    return;
  }
  // 匿名：只记录，不回复，也看不到别人的消息
  $("chatInput").disabled = false;
  $("chatSend").disabled = false;
  $("chatInput").placeholder = "匿名留言，只记录不回复…";
  $("chatStatus").textContent = "匿名留言模式 · 仅记录";
  $("aiToggleWrap").hidden = true;
  $("chatLog").replaceChildren(welcomeBlock());
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

function welcomeBlock() {
  const box = el("div", "chat-welcome");
  box.append(el("p", "chat-welcome-title", "👋 欢迎来聊天室"));
  box.append(el("p", "chat-welcome-sub", me ? "随便聊聊，小助手也在" : "登录后进入聊天室；匿名留言只被记录"));
  if (me) {
    const chips = el("div", "chat-welcome-chips");
    for (const t of ["有人在吗", "今天过得怎么样"]) {
      const b = el("button", "chat-chip", t);
      b.type = "button";
      b.onclick = () => sendChat(t);
      chips.append(b);
    }
    box.append(chips);
  }
  return box;
}

function addLine(node) {
  $("chatLog").append(node);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function renderChat(m, animate = false) {
  // Ask AI 风格：自己的消息右侧高亮气泡，小助手/他人左侧带名字
  const own = me && m.user !== "小助手" && m.user === (me.name || me.email);
  const isAssistant = m.user === "小助手";
  const bubble = el("div", `chat-msg${own ? " own" : ""}${isAssistant ? " assistant" : ""}`);
  if (!own) bubble.append(el("span", "chat-user", m.user));
  const body = el("div", "chat-bubble");
  bubble.append(body, el("span", "chat-time", fmtTime(m.ts)));
  if (animate && isAssistant) {
    body.classList.add("typing");
    body.append(el("i"), el("i"), el("i"));
    addLine(bubble);
    setTimeout(() => {
      body.classList.remove("typing");
      body.replaceChildren(document.createTextNode(m.text));
      $("chatLog").scrollTop = $("chatLog").scrollHeight;
    }, 400 + Math.min(m.text.length * 20, 900));
  } else {
    body.textContent = m.text;
    addLine(bubble);
  }
}
function renderSystem(text) {
  addLine(el("div", "chat-system", text));
}

function handle(data) {
  if (data.type === "history") {
    $("chatLog").replaceChildren();
    for (const m of data.messages || []) renderChat(m);
    if (!data.messages?.length) $("chatLog").append(welcomeBlock());
    return;
  }
  if (data.type === "chat") {
    renderChat(data.message, data.message.user === "小助手");
    if (!isOpen()) setUnread(unread + 1);
  }
  if (data.type === "system") renderSystem(data.text);
  if (data.type === "presence") {
    $("chatPresence").textContent = data.count ? `在线 ${data.count} 人` : "";
    $("chatFabPill").hidden = !data.count;
    $("chatFabPill").textContent = `${data.count} 人在线`;
    if (me?.isAdmin) {
      const strip = $("chatIpStrip");
      const clients = data.clients || [];
      strip.hidden = !clients.length;
      strip.replaceChildren(...clients.map((c) => el("span", null, `${c.name} · ${c.ip || "IP 未知"}${c.guest ? " · 游客" : ""}`)));
    }
  }
}

function sendChat(text) {
  if (!text || !socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "chat", text, ai: Boolean(me && $("aiToggle").checked) }));
  // 游客消息不会被回显，本地补一条
  if (!me) renderChat({ user: "我", text, ts: Date.now() });
}
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("chatInput").value.trim();
  sendChat(text);
  $("chatInput").value = "";
};
