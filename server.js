const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ---------- LOGGING ----------
function log(level, msg, meta = {}) {
  const entry = { time: new Date().toISOString(), level, msg, ...meta };
  console.log(JSON.stringify(entry));
}

// ---------- SECURITY ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Intenta mas tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones. Intenta mas tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- MIDDLEWARE ----------
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-produccion',
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
  }
});

app.use(sessionMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: IS_PROD ? '1d' : 0 }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('info', 'request', { method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

function genCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sanitizeStr(v, max = 200) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

// ---------- HEALTH CHECK ----------
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (err) {
    log('error', 'health check failed', { error: err.message });
    res.status(503).json({ status: 'error' });
  }
});

// ---------- PREPARED STATEMENTS ----------
const stmts = {
  createUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  getUserByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  getUserById: db.prepare('SELECT id, username, created_at FROM users WHERE id = ?'),
  createChat: db.prepare('INSERT INTO chats (code, name, created_by) VALUES (?, ?, ?)'),
  getChatByCode: db.prepare('SELECT * FROM chats WHERE code = ?'),
  getChatById: db.prepare('SELECT * FROM chats WHERE id = ?'),
  addMember: db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)'),
  isMember: db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?'),
  listUserChats: db.prepare(`
    SELECT c.* FROM chats c
    JOIN chat_members m ON m.chat_id = c.id
    WHERE m.user_id = ?
    ORDER BY c.created_at DESC
  `),
  countMembers: db.prepare('SELECT COUNT(*) as n FROM chat_members WHERE chat_id = ?'),
  insertMessage: db.prepare('INSERT INTO messages (chat_id, user_id, content) VALUES (?, ?, ?)'),
  listMessages: db.prepare(`
    SELECT m.id, m.content, m.created_at, u.username
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.chat_id = ?
    ORDER BY m.id ASC
    LIMIT 100
  `)
};

// ---------- AUTH ----------
app.post('/api/register', authLimiter, async (req, res) => {
  const username = sanitizeStr(req.body.username, 30);
  const password = req.body.password || '';
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (username.length < 3) return res.status(400).json({ error: 'Usuario minimo 3 caracteres' });
  if (password.length < 6) return res.status(400).json({ error: 'Contraseña minimo 6 caracteres' });
  if (stmts.getUserByName.get(username)) return res.status(409).json({ error: 'Usuario ya existe' });
  const hash = await bcrypt.hash(password, 12);
  const info = stmts.createUser.run(username, hash);
  req.session.userId = info.lastInsertRowid;
  log('info', 'user registered', { username });
  res.json({ id: info.lastInsertRowid, username });
});

app.post('/api/login', authLimiter, async (req, res) => {
  const username = sanitizeStr(req.body.username, 30);
  const password = req.body.password || '';
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  const user = stmts.getUserByName.get(username);
  if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales invalidas' });
  req.session.userId = user.id;
  log('info', 'user logged in', { username });
  res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = stmts.getUserById.get(req.session.userId);
  res.json({ user });
});

// ---------- CHATS ----------
app.post('/api/chats', apiLimiter, requireAuth, (req, res) => {
  const name = sanitizeStr(req.body.name, 100);
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const code = genCode();
  const info = stmts.createChat.run(code, name, req.session.userId);
  const chatId = info.lastInsertRowid;
  stmts.addMember.run(chatId, req.session.userId);
  const chat = stmts.getChatById.get(chatId);
  log('info', 'chat created', { chatId, name, code });
  res.json({ chat, link: `/chat.html?c=${chat.code}` });
});

app.post('/api/chats/join', apiLimiter, requireAuth, (req, res) => {
  const code = sanitizeStr(req.body.code, 10).toUpperCase();
  if (!code) return res.status(400).json({ error: 'Codigo requerido' });
  const chat = stmts.getChatByCode.get(code);
  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
  stmts.addMember.run(chat.id, req.session.userId);
  log('info', 'user joined chat', { chatId: chat.id, userId: req.session.userId });
  res.json({ chat, link: `/chat.html?c=${chat.code}` });
});

app.get('/api/chats', requireAuth, (req, res) => {
  const chats = stmts.listUserChats.all(req.session.userId).map(c => ({
    ...c,
    members: stmts.countMembers.get(c.id).n,
    link: `/chat.html?c=${c.code}`
  }));
  res.json({ chats });
});

app.get('/api/chats/by-code/:code', (req, res) => {
  const code = sanitizeStr(req.params.code, 10).toUpperCase();
  const chat = stmts.getChatByCode.get(code);
  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
  const me = req.session.userId ? stmts.isMember.get(chat.id, req.session.userId) : null;
  const members = stmts.countMembers.get(chat.id).n;
  res.json({
    chat: { ...chat, members },
    isMember: !!me,
    link: `/chat.html?c=${chat.code}`
  });
});

app.get('/api/chats/:id/participants', requireAuth, (req, res) => {
  const chatId = Number(req.params.id);
  if (!Number.isInteger(chatId)) return res.status(400).json({ error: 'ID invalido' });
  const chat = stmts.getChatById.get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
  if (!stmts.isMember.get(chatId, req.session.userId)) {
    return res.status(403).json({ error: 'No eres miembro de este chat' });
  }
  const rows = db.prepare(`
    SELECT u.id, u.username FROM users u
    JOIN chat_members m ON m.user_id = u.id
    WHERE m.chat_id = ? ORDER BY u.username ASC
  `).all(chatId);
  const usernames = rows.map(r => r.username);
  io.to(`chat:${chatId}`).emit('participants', { chatId, usernames });
  res.json({ usernames });
});

app.get('/api/chats/:id/messages', requireAuth, (req, res) => {
  const chatId = Number(req.params.id);
  if (!Number.isInteger(chatId)) return res.status(400).json({ error: 'ID invalido' });
  const chat = stmts.getChatById.get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
  if (!stmts.isMember.get(chatId, req.session.userId)) {
    return res.status(403).json({ error: 'No eres miembro de este chat' });
  }
  const messages = stmts.listMessages.all(chatId);
  res.json({ chat, messages });
});

// ---------- SOCKET.IO ----------
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const userId = socket.request.session.userId;
  if (!userId) {
    socket.disconnect();
    return;
  }
  const user = stmts.getUserById.get(userId);
  if (!user) { socket.disconnect(); return; }
  socket.data.user = user;

  socket.on('join_chat', ({ chatId }) => {
    const me = socket.data.user;
    if (!Number.isInteger(chatId) || !stmts.isMember.get(chatId, me.id)) return;
    socket.join(`chat:${chatId}`);
    io.to(`chat:${chatId}`).emit('user_joined', { chatId, userId: me.id, username: me.username });
  });

  socket.on('send_message', ({ chatId, content }) => {
    if (!chatId || !content || !content.trim()) return;
    if (!stmts.isMember.get(chatId, userId)) return;
    const trimmed = content.trim().slice(0, 2000);
    const info = stmts.insertMessage.run(chatId, userId, trimmed);
    io.to(`chat:${chatId}`).emit('message', {
      id: info.lastInsertRowid,
      chatId,
      content: trimmed,
      username: user.username,
      created_at: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {});
});

// ---------- ERROR HANDLING ----------
app.use((err, req, res, _next) => {
  log('error', 'unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ---------- GRACEFUL SHUTDOWN ----------
function shutdown(signal) {
  log('info', `${signal} received, shutting down gracefully`);
  server.close(() => {
    db.close();
    log('info', 'server closed');
    process.exit(0);
  });
  setTimeout(() => {
    log('error', 'forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------- START ----------
server.listen(PORT, () => {
  log('info', `server started`, { port: PORT, env: IS_PROD ? 'production' : 'development' });
});
