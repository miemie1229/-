/* ============================================================
   配置区 - 替换成你的扣子 API 信息
   ============================================================ */
const CONFIG = {
  apiToken: 'pat_8PW4mNydSwgVZGwpCvTet9gAqE35K8Ql9HNfnFia2hyuFJ2iVbB3jvYgWR9XDEID',
  botId:    '7643773863985758227',
  apiBase:  'https://api.coze.cn',
};

const PROLOGUE = `hi~我是你的AI人才sourcing助手✧｡٩(ˊᗜˋ)و✧*｡
最近关注哪所高校，或者哪个实验室？让我来为你绘制专属人才地图！找到科研大佬，并帮你与他们建立联系和初步沟通！₍₍ ᕕ(´ ω\` )ᕗ⁾⁾`;

/* ============================================================
   状态管理 - 完整保存含消息内容
   ============================================================ */
let chats = JSON.parse(localStorage.getItem('sourcing_chats') || '[]');
let currentChatId = null;

function saveChats() {
  localStorage.setItem('sourcing_chats', JSON.stringify(chats));
}

function getChat(id) {
  return chats.find(c => c.id === id);
}

function createChat() {
  const id = Date.now().toString();
  const chat = {
    id,
    title: '新对话',
    messages: [], // { role: 'user'|'ai', content: string }
    createdAt: id,
  };
  chats.unshift(chat);
  saveChats();
  return chat;
}

function updateChatTitle(id, title) {
  const chat = getChat(id);
  if (chat) { chat.title = title.slice(0, 30); saveChats(); }
}

/* ============================================================
   渲染历史列表
   ============================================================ */
function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'history-item' + (chat.id === currentChatId ? ' active' : '');
    item.textContent = chat.title;
    item.title = chat.title;
    item.dataset.id = chat.id;
    item.addEventListener('click', () => switchChat(chat.id));
    list.appendChild(item);
  });
}

/* ============================================================
   渲染消息（含开场白）
   ============================================================ */
function renderMessages(messages) {
  const container = document.getElementById('messages');
  const welcome   = document.getElementById('welcome');
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    welcome.style.display = 'flex';
    container.style.display = 'none';
    return;
  }

  welcome.style.display = 'none';
  container.style.display = 'flex';
  messages.forEach(msg => appendMessageDOM(msg.role, msg.content, false));
  scrollToBottom();
}

function appendMessageDOM(role, content, animate = true) {
  const welcome   = document.getElementById('welcome');
  const container = document.getElementById('messages');
  welcome.style.display = 'none';
  container.style.display = 'flex';

  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (!animate) div.style.animation = 'none';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  div.appendChild(bubble);
  container.appendChild(div);
  if (animate) scrollToBottom();
  return bubble;
}

function appendTypingIndicator() {
  const welcome   = document.getElementById('welcome');
  const container = document.getElementById('messages');
  welcome.style.display = 'none';
  container.style.display = 'flex';

  const div = document.createElement('div');
  div.className = 'message ai typing';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function scrollToBottom() {
  const c = document.getElementById('chat-container');
  c.scrollTop = c.scrollHeight;
}

/* ============================================================
   切换对话（恢复完整历史消息）
   ============================================================ */
function switchChat(id) {
  currentChatId = id;
  const chat = getChat(id);
  renderMessages(chat ? chat.messages : []);
  renderHistory();
}

/* ============================================================
   新建对话（显示开场白）
   ============================================================ */
function startNewChat() {
  const chat = createChat();
  currentChatId = chat.id;

  // 把开场白作为 ai 消息存入，这样切换回来也能看到
  chat.messages.push({ role: 'ai', content: PROLOGUE });
  saveChats();

  renderMessages(chat.messages);
  renderHistory();
  document.getElementById('user-input').focus();
}

/* ============================================================
   发送消息
   ============================================================ */
async function sendMessage(text) {
  if (!text.trim()) return;

  if (!currentChatId) {
    startNewChat();
  }

  const chat = getChat(currentChatId);
  if (!chat) return;

  // 保存用户消息
  chat.messages.push({ role: 'user', content: text });
  if (chat.title === '新对话') {
    updateChatTitle(currentChatId, text);
    renderHistory();
  }
  saveChats();
  appendMessageDOM('user', text);

  const input   = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  appendTypingIndicator();

  try {
    const reply = await callCozeAPI(chat.messages);
    removeTypingIndicator();
    chat.messages.push({ role: 'ai', content: reply });
    saveChats();
    appendMessageDOM('ai', reply);
  } catch (err) {
    removeTypingIndicator();
    const errMsg = '请求失败：' + err.message;
    chat.messages.push({ role: 'ai', content: errMsg });
    saveChats();
    appendMessageDOM('ai', errMsg);
    console.error('Coze API Error:', err);
  }

  sendBtn.disabled = false;
  input.focus();
}

/* ============================================================
   扣子 API 调用
   ============================================================ */
async function callCozeAPI(messages) {
  const userId = localStorage.getItem('sourcing_user_id') || (() => {
    const id = 'user_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('sourcing_user_id', id);
    return id;
  })();

  // 过滤掉开场白，只传真实对话（user/ai 交替）
  const realMessages = messages.filter(m => m.content !== PROLOGUE);
  const additional_messages = realMessages.slice(-20).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    content_type: 'text',
  }));

  // 扣子 v3 要求 stream 与 auto_save_history 成对出现且互斥：
  // stream=false → auto_save_history=true（非流式 + 轮询）
  // stream=true  → auto_save_history=false（SSE 流式）
  const body = {
    bot_id: CONFIG.botId,
    user_id: userId,
    stream: false,
    auto_save_history: true,
    additional_messages,
  };

  const res = await fetch(`${CONFIG.apiBase}/v3/chat`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${CONFIG.apiToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  if (data.code && data.code !== 0) {
    throw new Error(`API错误 ${data.code}: ${data.msg}`);
  }

  const chatId         = data.data.id;
  const conversationId = data.data.conversation_id;
  return await pollChatResult(chatId, conversationId);
}

/* 轮询结果 */
async function pollChatResult(chatId, conversationId, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(1500);
    const res = await fetch(
      `${CONFIG.apiBase}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
      { headers: { 'Authorization': `Bearer ${CONFIG.apiToken}` } }
    );
    const data = await res.json();
    const status = data.data && data.data.status;

    if (status === 'completed') {
      const msgRes = await fetch(
        `${CONFIG.apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
        { headers: { 'Authorization': `Bearer ${CONFIG.apiToken}` } }
      );
      const msgData = await msgRes.json();
      const answer = (msgData.data || []).find(
        m => m.role === 'assistant' && m.type === 'answer'
      );
      return answer ? answer.content : '（无回复）';
    }

    if (status === 'failed' || status === 'canceled' || status === 'requires_action') {
      throw new Error('对话异常，状态：' + status);
    }
  }
  throw new Error('等待回复超时，请重试');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ============================================================
   输入框自动高度
   ============================================================ */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

/* ============================================================
   侧边栏折叠
   ============================================================ */
let sidebarCollapsed = false;

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar   = document.getElementById('sidebar');
  const openBtn   = document.getElementById('open-sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  openBtn.style.display   = sidebarCollapsed ? 'flex' : 'none';
  toggleBtn.style.display = sidebarCollapsed ? 'none' : 'flex';
}

/* ============================================================
   图片加载兜底
   ============================================================ */
function initSheepImage() {
  const img = document.getElementById('sheep-img');
  const svg = document.getElementById('sheep-svg');
  img.addEventListener('error', () => {
    img.style.display = 'none';
    svg.style.display = 'block';
  });
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  initSheepImage();
  renderHistory();

  // 有历史则打开最近一条（含完整消息）
  if (chats.length > 0) {
    switchChat(chats[0].id);
  }

  const input   = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');

  input.addEventListener('input', () => {
    autoResize(input);
    sendBtn.disabled = !input.value.trim();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage(input.value);
    }
  });

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  document.getElementById('new-chat-btn').addEventListener('click', startNewChat);
  document.getElementById('new-chat-top').addEventListener('click', startNewChat);
  document.getElementById('toggle-sidebar').addEventListener('click', toggleSidebar);
  document.getElementById('open-sidebar').addEventListener('click', toggleSidebar);
}

document.addEventListener('DOMContentLoaded', init);
