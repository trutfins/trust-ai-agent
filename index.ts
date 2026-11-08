import { DurableObject } from "cloudflare:workers";
import { Workspace } from "@cloudflare/computer";
import { createPiTools } from "@cloudflare/computer/tools/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";
import { createAI } from "agents/models/pi-ai";
import { routeAgentRequest } from "agents/routing";
import { WebSockets } from "agents/websockets";

export class Assistant extends DurableObject {
	ai = createAI({ binding: this.env.AI });
	registry = createRegistry();
	workspace = new Workspace({ storage: this.ctx.storage });

	harness = new PiHarness({
		harness: ({ storage, context, onWake }) => {
			const { tools, execute } = createPiTools({ workspace: this.workspace });
			this.registry.install({
				name: "workspace",
				tools: tools.map((tool) => ({
					...tool,
					async execute(args, api, ctx) {
						const { content, isError } = await execute(
							{ id: api.callId, name: tool.name, arguments: args },
							{ abortSignal: ctx.abortSignal },
						);
						return { output: content, isError };
					},
				})),
			});

			const models = createModels();
			models.setProvider(this.ai.provider);
			return Harness.open(storage, { models, registry: this.registry, onWake }, context);
		},
		defaults: {
			model: this.ai("@cf/zai-org/glm-5.3-flash"),
			systemPrompt: "أنت مساعد ذكي متخصص في الخدمات المالية والمحاسبية لمنصة ترست."
		},
	});

	webSockets = new WebSockets({
		handlers: {
			onMessage: async (connection, message) => {
				const { text } = await this.harness.prompt(String(message));
				connection.send(text ?? "");
			},
		},
	});

	lifecycle = Lifecycle.install(this).use(this.harness).use(this.webSockets);

	async onRequest(request: Request) {
		if (request.method !== "POST") {
			return Response.json(await this.harness.messages());
		}
		const { status, text } = await this.harness.prompt(await request.text());
		return Response.json({ status, text });
	}
}

function renderHtml(supabaseUrl: string, supabaseKey: string): string {
	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ترست | المساعد المالي الذكي</title>
<style>
:root {
  --primary: #0b6b53;
  --primary-dark: #074d3b;
  --primary-light: #e8f5f0;
  --accent: #c9a96e;
  --bg: #f7f8fa;
  --surface: #ffffff;
  --text: #1a1f2e;
  --text-muted: #6b7280;
  --border: #e5e7eb;
  --error: #dc2626;
  --success: #16a34a;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', 'Tahoma', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.header {
  background: linear-gradient(135deg, var(--primary-dark), var(--primary));
  color: white;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  flex-shrink: 0;
}
.header-logo {
  width: 40px; height: 40px;
  background: rgba(255,255,255,0.15);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700;
}
.header-title { font-size: 20px; font-weight: 600; }
.header-sub { font-size: 13px; opacity: 0.8; margin-top: 2px; }
.header-right { margin-right: auto; display: flex; align-items: center; gap: 12px; }
.user-email { font-size: 13px; opacity: 0.9; }
.logout-btn {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  color: white;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.logout-btn:hover { background: rgba(255,255,255,0.25); }
.app-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.sidebar {
  width: 260px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.new-chat-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  flex: 1;
  transition: background 0.2s;
}
.new-chat-btn:hover { background: var(--primary-dark); }
.conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.conv-item {
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: background 0.15s;
}
.conv-item:hover { background: var(--bg); }
.conv-item.active { background: var(--primary-light); color: var(--primary-dark); font-weight: 500; }
.conv-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-delete {
  opacity: 0;
  background: none; border: none;
  color: var(--error);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
}
.conv-item:hover .conv-delete { opacity: 0.6; }
.conv-delete:hover { opacity: 1; background: rgba(220,38,38,0.1); }
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-container {
  flex: 1;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
  overflow: hidden;
}
.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 4px;
}
.welcome {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
}
.welcome-icon {
  width: 64px; height: 64px;
  margin: 0 auto 16px;
  background: var(--primary-light);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px;
}
.welcome h2 { color: var(--text); font-size: 22px; margin-bottom: 8px; }
.welcome p { font-size: 15px; line-height: 1.6; max-width: 400px; margin: 0 auto; }
.welcome-suggestions {
  display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px;
}
.suggestion {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--primary);
  cursor: pointer;
  transition: all 0.2s;
}
.suggestion:hover { background: var(--primary-light); border-color: var(--primary); }
.message {
  display: flex;
  gap: 10px;
  max-width: 85%;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.message.user { align-self: flex-start; flex-direction: row-reverse; }
.message.assistant { align-self: flex-start; }
.avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 600;
  color: white;
}
.message.user .avatar { background: var(--accent); }
.message.assistant .avatar { background: var(--primary); }
.bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.message.user .bubble { background: var(--primary-light); border-color: transparent; }
.typing {
  display: inline-flex; gap: 4px; padding: 4px 0;
}
.typing span {
  width: 8px; height: 8px;
  background: var(--text-muted);
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
.input-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.input-bar textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 15px;
  font-family: inherit;
  padding: 8px 10px;
  max-height: 120px;
  line-height: 1.5;
  background: transparent;
  color: var(--text);
}
.send-btn {
  width: 42px; height: 42px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  transition: background 0.2s;
  flex-shrink: 0;
}
.send-btn:hover { background: var(--primary-dark); }
.send-btn:disabled { background: var(--border); cursor: not-allowed; }
.status-bar {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px;
}
.status-bar.error { color: var(--error); }
.auth-overlay {
  position: fixed; inset: 0;
  background: linear-gradient(135deg, var(--primary-dark), var(--primary));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.auth-card {
  background: var(--surface);
  border-radius: 20px;
  padding: 40px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.auth-logo {
  width: 56px; height: 56px;
  background: var(--primary);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700;
  color: white;
  margin: 0 auto 20px;
}
.auth-title { text-align: center; font-size: 24px; font-weight: 600; margin-bottom: 6px; }
.auth-sub { text-align: center; font-size: 14px; color: var(--text-muted); margin-bottom: 28px; }
.auth-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 24px;
}
.auth-tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-muted);
  transition: all 0.2s;
}
.auth-tab.active { background: var(--surface); color: var(--primary); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.auth-field { margin-bottom: 16px; }
.auth-field label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
.auth-field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.auth-field input:focus { border-color: var(--primary); }
.auth-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: var(--error);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 16px;
  display: none;
}
.auth-error.show { display: block; }
.auth-submit {
  width: 100%;
  padding: 13px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.auth-submit:hover { background: var(--primary-dark); }
.auth-submit:disabled { background: var(--border); cursor: not-allowed; }
.app-hidden { display: none !important; }
@media (max-width: 640px) {
  .sidebar { display: none; }
  .auth-card { padding: 28px 20px; }
}
</style>
</head>
<body>

<div class="auth-overlay" id="authOverlay">
  <div class="auth-card">
    <div class="auth-logo">T</div>
    <div class="auth-title">ترست</div>
    <div class="auth-sub">المساعد المالي والمحاسبي الذكي</div>
    <div class="auth-tabs">
      <button class="auth-tab active" id="tabLogin" onclick="switchTab('login')">تسجيل الدخول</button>
      <button class="auth-tab" id="tabSignup" onclick="switchTab('signup')">حساب جديد</button>
    </div>
    <div class="auth-error" id="authError"></div>
    <div class="auth-field">
      <label for="authEmail">البريد الإلكتروني</label>
      <input type="email" id="authEmail" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="auth-field">
      <label for="authPassword">كلمة المرور</label>
      <input type="password" id="authPassword" placeholder="******" autocomplete="current-password">
    </div>
    <button class="auth-submit" id="authSubmit" onclick="handleAuth()">دخول</button>
  </div>
</div>

<div class="app-layout app-hidden" id="appLayout">
  <div class="sidebar">
  </div>
    <div class="sidebar-header">
      <button class="new-chat-btn" onclick="newConversation()">+ محادثة جديدة</button>
    </div>
    <div class="conv-list" id="convList"></div>
  </div>
  <div class="main-area">
    <div class="chat-container">
      <div class="messages" id="messages">
        <div class="welcome" id="welcome">
          <div class="welcome-icon">&#128181;</div>
          <h2>مرحباً بك في مساعد ترست</h2>
          <p>أنا مساعدك الذكي المتخصص في الخدمات المالية والمحاسبية. اسألني عن أي استفسار مالي أو محاسبي.</p>
          <div class="welcome-suggestions">
            <div class="suggestion" onclick="sendSuggestion('كيف أحسب ضريبة القيمة المضافة؟')">كيف أحسب ضريبة القيمة المضافة؟</div>
            <div class="suggestion" onclick="sendSuggestion('ما الفرق بين الأصول والخصوم؟')">ما الفرق بين الأصول والخصوم؟</div>
            <div class="suggestion" onclick="sendSuggestion('كيف أعد قائمة الدخل؟')">كيف أعد قائمة الدخل؟</div>
          </div>
        </div>
      </div>
      <div class="input-bar">
        <textarea id="input" rows="1" placeholder="اكتب رسالتك هنا..." onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>&#9654;</button>
      </div>
      <div class="status-bar" id="status">جاري الاتصال...</div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
const SUPABASE_KEY = ${JSON.stringify(supabaseKey)};
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentConvId = null;
let ws = null;
let connected = false;
let authMode = 'login';

const authOverlay = document.getElementById('authOverlay');
const appLayout = document.getElementById('appLayout');
const authError = document.getElementById('authError');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const statusEl = document.getElementById('status');
const convListEl = document.getElementById('convList');
let welcomeEl = document.getElementById('welcome');

function switchTab(mode) {
  authMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
  authSubmit.textContent = mode === 'login' ? 'دخول' : 'إنشاء حساب';
  authError.classList.remove('show');
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.add('show');
}

async function handleAuth() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) { showAuthError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return; }
  authSubmit.disabled = true;
  authSubmit.textContent = '...';
  try {
    let result;
    if (authMode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }
    if (result.error) {
      const msg = result.error.message.includes('Invalid login') ? 'البريد أو كلمة المرور غير صحيحة' :
                   result.error.message.includes('already registered') ? 'هذا البريد مسجل بالفعل' :
                   result.error.message;
      showAuthError(msg);
      authSubmit.disabled = false;
      authSubmit.textContent = authMode === 'login' ? 'دخول' : 'إنشاء حساب';
      return;
    }
    if (authMode === 'signup' && result.data.user && !result.data.session) {
      showAuthError('تم إنشاء الحساب. يرجى تسجيل الدخول.');
      switchTab('login');
      authPassword.value = '';
      authSubmit.disabled = false;
      authSubmit.textContent = 'دخول';
      return;
    }
  } catch (e) {
    showAuthError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'دخول' : 'إنشاء حساب';
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
}

function showApp(user) {
  currentUser = user;
  authOverlay.classList.add('app-hidden');
  appLayout.classList.remove('app-hidden');
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = user.email;
  const headerRight = document.getElementById('headerRight');
  if (headerRight) headerRight.classList.remove('app-hidden');
  loadConversations();
}

function showAuth() {
  currentUser = null;
  authOverlay.classList.remove('app-hidden');
  appLayout.classList.add('app-hidden');
  const headerRight = document.getElementById('headerRight');
  if (headerRight) headerRight.classList.add('app-hidden');
  authSubmit.disabled = false;
  authSubmit.textContent = authMode === 'login' ? 'دخول' : 'إنشاء حساب';
  authPassword.value = '';
}

async function loadConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false });
  if (error) { console.error('loadConversations error:', error); return; }
  renderConvList(data || []);
}

function renderConvList(convs) {
  convListEl.innerHTML = '';
  for (const c of convs) {
    const item = document.createElement('div');
    item.className = 'conv-item' + (c.id === currentConvId ? ' active' : '');
    item.innerHTML = '<span class="conv-title"></span><button class="conv-delete" title="حذف">&times;</button>';
    item.querySelector('.conv-title').textContent = c.title;
    item.onclick = (e) => {
      if (e.target.classList.contains('conv-delete')) {
        e.stopPropagation();
        deleteConversation(c.id);
      } else {
        openConversation(c.id);
      }
    };
    convListEl.appendChild(item);
  }
}

async function newConversation() {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ title: 'محادثة جديدة' })
    .select()
    .single();
  if (error) { console.error(error); return; }
  currentConvId = data.id;
  clearMessages();
  showWelcome();
  loadConversations();
  connectWS();
}

async function openConversation(convId) {
  currentConvId = convId;
  clearMessages();
  const { data: msgs, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return; }
  if (!msgs || msgs.length === 0) {
    showWelcome();
  } else {
    hideWelcome();
    for (const m of msgs) { addMessage(m.role, m.content); }
  }
  loadConversations();
  connectWS();
}

async function deleteConversation(convId) {
  const { error } = await supabase.from('conversations').delete().eq('id', convId);
  if (error) { console.error(error); return; }
  if (currentConvId === convId) {
    currentConvId = null;
    clearMessages();
    showWelcome();
    disconnectWS();
  }
  loadConversations();
}

async function saveMessage(role, content) {
  if (!currentConvId) return;
  const { error } = await supabase.from('messages').insert({
    conversation_id: currentConvId,
    role,
    content
  });
  if (error) console.error('saveMessage error:', error);
  if (role === 'user') {
    const { data } = await supabase.from('conversations').select('title').eq('id', currentConvId).maybeSingle();
    if (data && data.title === 'محادثة جديدة') {
      const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
      await supabase.from('conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', currentConvId);
    }
  } else {
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', currentConvId);
  }
}

function connectWS() {
  disconnectWS();
  if (!currentUser) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = location.pathname.replace(/\\/$/, '');
  const agentPath = base + '/agents/assistant/' + encodeURIComponent(currentUser.id);
  const wsUrl = proto + '//' + location.host + agentPath;
  ws = new WebSocket(wsUrl);
  ws.onopen = () => { connected = true; statusEl.textContent = 'متصل'; statusEl.classList.remove('error'); sendBtn.disabled = false; };
  ws.onclose = () => { connected = false; statusEl.textContent = 'انقطع الاتصال - إعادة المحاولة...'; statusEl.classList.add('error'); sendBtn.disabled = true; if (currentUser && currentConvId) setTimeout(connectWS, 2000); };
  ws.onerror = () => { statusEl.textContent = 'خطأ في الاتصال'; statusEl.classList.add('error'); };
  ws.onmessage = async (event) => {
    removeTyping();
    const text = event.data;
    addMessage('assistant', text);
    await saveMessage('assistant', text);
    loadConversations();
  };
}

function disconnectWS() {
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  connected = false;
  sendBtn.disabled = true;
}

function clearMessages() { messagesEl.innerHTML = ''; welcomeEl = null; }
function showWelcome() {
  clearMessages();
  messagesEl.innerHTML = '<div class="welcome" id="welcome"><div class="welcome-icon">&#128181;</div><h2>مرحباً بك في مساعد ترست</h2><p>أنا مساعدك الذكي المتخصص في الخدمات المالية والمحاسبية. اسألني عن أي استفسار مالي أو محاسبي.</p><div class="welcome-suggestions"><div class="suggestion" onclick="sendSuggestion(\\'كيف أحسب ضريبة القيمة المضافة؟\\')">كيف أحسب ضريبة القيمة المضافة؟</div><div class="suggestion" onclick="sendSuggestion(\\'ما الفرق بين الأصول والخصوم؟\\')">ما الفرق بين الأصول والخصوم؟</div><div class="suggestion" onclick="sendSuggestion(\\'كيف أعد قائمة الدخل؟\\')">كيف أعد قائمة الدخل؟</div></div></div>';
  welcomeEl = document.getElementById('welcome');
}
function hideWelcome() { if (welcomeEl) { welcomeEl.remove(); welcomeEl = null; } }

function addMessage(role, text) {
  hideWelcome();
  const msg = document.createElement('div');
  msg.className = 'message ' + role;
  const avatarText = role === 'user' ? 'أ' : 'ت';
  msg.innerHTML = '<div class="avatar">' + avatarText + '</div><div class="bubble"></div>';
  msg.querySelector('.bubble').textContent = text;
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  hideWelcome();
  const msg = document.createElement('div');
  msg.className = 'message assistant';
  msg.id = 'typing-msg';
  msg.innerHTML = '<div class="avatar">ت</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() { const t = document.getElementById('typing-msg'); if (t) t.remove(); }

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !connected) return;
  if (!currentConvId) { await newConversation(); }
  addMessage('user', text);
  await saveMessage('user', text);
  ws.send(text);
  inputEl.value = '';
  autoResize(inputEl);
  showTyping();
  loadConversations();
}

function sendSuggestion(text) { inputEl.value = text; sendMessage(); }

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

supabase.auth.onAuthStateChange((event, session) => {
  (async () => {
    if (session && session.user) {
      showApp(session.user);
    } else {
      disconnectWS();
      showAuth();
    }
  })();
})();
</script>
</body>
</html>`;
}

export default {
	async fetch(request: Request, env: any) {
		const url = new URL(request.url);
		if (url.pathname === "/" || url.pathname === "/index.html") {
			const supabaseUrl = env.SUPABASE_URL || (globalThis as any).SUPABASE_URL || "";
			const supabaseKey = env.SUPABASE_ANON_KEY || (globalThis as any).SUPABASE_ANON_KEY || "";
			return new Response(renderHtml(supabaseUrl, supabaseKey), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		return (
			(await routeAgentRequest(request, env)) ??
			new Response("Not found", { status: 404 })
		);
	},
};
