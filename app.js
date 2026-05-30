/* ============================================================
   配置区 - 替换成你的扣子 API 信息
   ============================================================ */
const CONFIG = {
  apiToken: 'pat_8PW4mNydSwgVZGwpCvTet9gAqE35K8Ql9HNfnFia2hyuFJ2iVbB3jvYgWR9XDEID',
  botId:    '7643773863985758227',
  apiBase:  'https://api.coze.cn',
};

const PROLOGUE = `hi！✧｡٩(ˊᗜˋ)و✧*｡我是你的AI人才sourcing助手咩咩 Ꮚ･ꈊ･Ꮚ
最近关注哪所高校，或者哪个实验室？让我来为你绘制专属人才地图！找到科研大佬，并帮你与他们建立联系和初步沟通！₍₍ ᕕ(´ ω\` )ᕗ⁾⁾`;

const AVATAR = {
  ai:   'sheep.png',
  user: 'user-avatar.png',
};

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
    conversationId: null, // 扣子会话 ID，用于多轮上下文
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
function showSplash() {
  const welcome = document.getElementById('welcome');
  const container = document.getElementById('messages');
  const main = document.getElementById('main');
  welcome.style.display = 'flex';
  welcome.classList.remove('splash-hide');
  container.style.display = 'none';
  container.innerHTML = '';
  main.classList.add('awaiting-start');
}

function hideSplash() {
  const welcome = document.getElementById('welcome');
  const main = document.getElementById('main');
  welcome.classList.add('splash-hide');
  welcome.style.display = 'none';
  main.classList.remove('awaiting-start');
}

function isAwaitingStart() {
  return document.getElementById('main').classList.contains('awaiting-start');
}

function renderMessages(messages) {
  const container = document.getElementById('messages');
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    showSplash();
    return;
  }

  hideSplash();
  container.style.display = 'flex';
  messages.forEach(msg => appendMessageDOM(msg.role, msg.content, false));
  scrollToBottom();
}

function appendMessageDOM(role, content, animate = true) {
  const container = document.getElementById('messages');
  hideSplash();
  container.style.display = 'flex';

  const div = document.createElement('div');
  div.className = `message ${role}` + (animate ? ' msg-pop-in' : '');
  if (!animate) div.style.animation = 'none';

  const row = document.createElement('div');
  row.className = 'msg-row';

  const avatar = document.createElement('img');
  avatar.className = 'msg-avatar';
  avatar.src = role === 'user' ? AVATAR.user : AVATAR.ai;
  avatar.alt = '';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;

  if (role === 'user') {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }
  div.appendChild(row);
  container.appendChild(div);
  if (animate) scrollToBottom();
  return bubble;
}

function appendTypingIndicator() {
  const container = document.getElementById('messages');
  hideSplash();
  container.style.display = 'flex';

  const div = document.createElement('div');
  div.className = 'message ai typing';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-row">
      <img class="msg-avatar" src="${AVATAR.ai}" alt="" />
      <div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
    </div>`;
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
  if (chat && chat.messages.length > 0) {
    renderMessages(chat.messages);
  } else {
    showSplash();
  }
  renderHistory();
}

/* ============================================================
   开屏：点击羊羊 → 发送开场白
   ============================================================ */
function beginConversation() {
  if (!currentChatId) {
    const chat = createChat();
    currentChatId = chat.id;
    renderHistory();
  }

  const chat = getChat(currentChatId);
  if (!chat) return;

  hideSplash();
  const container = document.getElementById('messages');
  container.style.display = 'flex';
  container.innerHTML = '';

  const hasPrologue = chat.messages.some(m => m.role === 'ai' && m.content === PROLOGUE);
  if (!hasPrologue) {
    chat.messages.push({ role: 'ai', content: PROLOGUE });
    saveChats();
    appendMessageDOM('ai', PROLOGUE, true);
  } else {
    appendMessageDOM('ai', PROLOGUE, false);
  }

  document.getElementById('user-input').focus();
}

/* ============================================================
   新建对话（回到开屏，待点击羊羊）
   ============================================================ */
function startNewChat() {
  const chat = createChat();
  currentChatId = chat.id;
  showSplash();
  renderHistory();
}

/* ============================================================
   发送消息
   ============================================================ */
async function sendMessage(text) {
  if (!text.trim()) return;
  if (isAwaitingStart()) return;

  if (!currentChatId) {
    beginConversation();
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
    const reply = await callCozeAPI(chat.messages, chat);
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
async function callCozeAPI(messages, chat) {
  const userId = localStorage.getItem('sourcing_user_id') || (() => {
    const id = 'user_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('sourcing_user_id', id);
    return id;
  })();

  const realMessages = messages.filter(m => m.content !== PROLOGUE);
  const lastUser = [...realMessages].reverse().find(m => m.role === 'user');
  if (!lastUser) throw new Error('没有可发送的用户消息');

  // 官方要求 additional_messages 仅传 role=user；上下文由 conversation_id + auto_save_history 维护
  const additional_messages = [{
    role: 'user',
    content: lastUser.content,
    content_type: 'text',
  }];

  const body = {
    bot_id: CONFIG.botId,
    user_id: userId,
    stream: false,
    auto_save_history: true,
    additional_messages,
  };

  let url = `${CONFIG.apiBase}/v3/chat`;
  if (chat.conversationId) {
    url += `?conversation_id=${encodeURIComponent(chat.conversationId)}`;
  }

  const res = await fetch(url, {
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
  if (conversationId) chat.conversationId = conversationId;

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
    if (data.code && data.code !== 0) {
      throw new Error(`轮询错误 ${data.code}: ${data.msg || ''}`);
    }

    const chatData = data.data || {};
    const status = chatData.status;

    if (status === 'completed') {
      const msgRes = await fetch(
        `${CONFIG.apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
        { headers: { 'Authorization': `Bearer ${CONFIG.apiToken}` } }
      );
      const msgData = await msgRes.json();
      const answers = (msgData.data || []).filter(
        m => m.role === 'assistant' && m.type === 'answer'
      );
      if (answers.length === 0) return '（无回复）';
      return answers.map(m => m.content).join('\n');
    }

    if (status === 'failed' || status === 'canceled' || status === 'requires_action') {
      const lastError = chatData.last_error;
      const detail = lastError && lastError.msg
        ? `${lastError.msg} (code ${lastError.code})`
        : status;
      throw new Error(`对话异常：${detail}`);
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
  const useSvg = () => {
    img.style.display = 'none';
    svg.style.display = 'block';
  };
  const useImg = () => {
    img.style.display = 'block';
    svg.style.display = 'none';
  };
  img.addEventListener('error', useSvg);
  img.addEventListener('load', useImg);
  if (img.complete) {
    img.naturalWidth > 0 ? useImg() : useSvg();
  }
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  initSheepImage();
  renderHistory();
  showSplash();

  document.getElementById('sheep-start').addEventListener('click', beginConversation);

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
