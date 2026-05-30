/* ============================================================
   配置区 - 替换成你的扣子 API 信息
   ============================================================ */
const CONFIG = {
  apiToken: 'pat_8PW4mNydSwgVZGwpCvTet9gAqE35K8Ql9HNfnFia2hyuFJ2iVbB3jvYgWR9XDEID',   // 扣子 Personal Access Token
  botId:    '7643773863985758227',           // 主 Agent 的 Bot ID
  apiBase:  'https://api.coze.cn',   // 国内用 coze.cn，海外用 coze.com
};

/* ============================================================
   状态管理
   ============================================================ */
let chats = JSON.parse(localStorage.getItem('sheep_chats') || '[]');
let currentChatId = null;

function saveChats() {
  localStorage.setItem('sheep_chats', JSON.stringify(chats));
}

function getChat(id) {
  return chats.find(c => c.id === id);
}

function createChat() {
  const id = Date.now().toString();
  const chat = { id, title: '新对话', messages: [], createdAt: id };
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
   渲染消息
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

  messages.forEach(msg => appendMessageDOM(msg.role, msg.content));
}

function appendMessageDOM(role, content) {
  const welcome   = document.getElementById('welcome');
  const container = document.getElementById('messages');
  welcome.style.display = 'none';
  container.style.display = 'flex';

  const div = document.createElement('div');
  div.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  div.appendChild(bubble);
  container.appendChild(div);
  scrollToBottom();
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
  div.innerHTML = `
    <div class="bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function scrollToBottom() {
  const chatContainer = document.getElementById('chat-container');
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ============================================================
   切换对话
   ============================================================ */
function switchChat(id) {
  currentChatId = id;
  const chat = getChat(id);
  renderMessages(chat ? chat.messages : []);
  renderHistory();
}

/* ============================================================
   新建对话
   ============================================================ */
function startNewChat() {
  const chat = createChat();
  currentChatId = chat.id;
  renderMessages([]);
  renderHistory();
  document.getElementById('user-input').focus();
}

/* ============================================================
   发送消息 & 调用扣子 API
   ============================================================ */
async function sendMessage(text) {
  if (!text.trim()) return;

  // 确保有当前对话
  if (!currentChatId) {
    const chat = createChat();
    currentChatId = chat.id;
    renderHistory();
  }

  const chat = getChat(currentChatId);
  if (!chat) return;

  // 推入用户消息
  chat.messages.push({ role: 'user', content: text });
  if (chat.title === '新对话') {
    updateChatTitle(currentChatId, text);
    renderHistory();
  }
  saveChats();
  appendMessageDOM('user', text);

  // 禁用输入
  const input  = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  // 显示 typing
  appendTypingIndicator();

  try {
    const reply = await callCozeAPI(chat.messages);
    removeTypingIndicator();
    chat.messages.push({ role: 'ai', content: reply });
    saveChats();
    appendMessageDOM('ai', reply);
  } catch (err) {
    removeTypingIndicator();
    const errMsg = '请求失败，请检查 API Token 和 Bot ID 配置。错误：' + err.message;
    appendMessageDOM('ai', errMsg);
    console.error('Coze API Error:', err);
  }

  sendBtn.disabled = false;
  input.focus();
}

/* ============================================================
   扣子 API 调用（非流式）
   替换成流式可参考注释中的 SSE 版本
   ============================================================ */
async function callCozeAPI(messages) {
  // 把历史消息转成扣子格式
  const cozeMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    content_type: 'text',
  }));

  // 只保留最后 20 条，避免 token 超限
  const trimmed = cozeMessages.slice(-20);
  // 去掉最后一条（本次 user 消息单独传）
  const history = trimmed.slice(0, -1);
  const userMsg = trimmed[trimmed.length - 1];

  const userId = localStorage.getItem('sheep_user_id') || (() => {
    const id = 'user_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('sheep_user_id', id);
    return id;
  })();

  const body = {
    bot_id: CONFIG.botId,
    user_id: userId,
    stream: false,
    auto_save_history: false,
    additional_messages: history,
    messages: [userMsg],
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

  // 轮询获取结果（chat 为异步时需要轮询）
  if (data.data && data.data.status === 'in_progress') {
    return await pollChatResult(data.data.id, data.data.conversation_id);
  }

  // 直接返回结果
  if (data.data && data.data.messages) {
    const answer = data.data.messages.find(m => m.role === 'assistant' && m.type === 'answer');
    return answer ? answer.content : '（无回复）';
  }

  // v3 同步结果
  if (data.messages) {
    const answer = data.messages.find(m => m.role === 'assistant' && m.type === 'answer');
    return answer ? answer.content : '（无回复）';
  }

  throw new Error('Unexpected response: ' + JSON.stringify(data));
}

/* 轮询（当 chat 为异步时） */
async function pollChatResult(chatId, conversationId, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(1000);
    const res = await fetch(
      `${CONFIG.apiBase}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
      {
        headers: { 'Authorization': `Bearer ${CONFIG.apiToken}` }
      }
    );
    const data = await res.json();
    if (data.data && data.data.status === 'completed') {
      // 获取消息列表
      const msgRes = await fetch(
        `${CONFIG.apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
        { headers: { 'Authorization': `Bearer ${CONFIG.apiToken}` } }
      );
      const msgData = await msgRes.json();
      const answer = (msgData.data || []).find(m => m.role === 'assistant' && m.type === 'answer');
      return answer ? answer.content : '（无回复）';
    }
    if (data.data && (data.data.status === 'failed' || data.data.status === 'canceled')) {
      throw new Error('Chat ended with status: ' + data.data.status);
    }
  }
  throw new Error('Timeout waiting for response');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ============================================================
   自动调整输入框高度
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
  const sidebar    = document.getElementById('sidebar');
  const openBtn    = document.getElementById('open-sidebar');
  const toggleBtn  = document.getElementById('toggle-sidebar');
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  openBtn.style.display    = sidebarCollapsed ? 'flex' : 'none';
  toggleBtn.style.display  = sidebarCollapsed ? 'none' : 'flex';
}

/* ============================================================
   图片加载兜底：若 sheep.png 不存在，显示 SVG
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

  // 如果有历史，默认打开最近一条
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
