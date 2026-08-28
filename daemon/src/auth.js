// ============================================
// MCForge Daemon - Autenticação (JWT + RBAC)
// ============================================
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getConfig, setPassword, verifyPassword, hasPassword, getUsers, saveUsers } = require('./config');
const { log, generateId } = require('./utils');

// ---------- Tokens ----------
function createToken(sub, role) {
  const config = getConfig();
  return jwt.sign({ sub, role }, config.jwtSecret, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getConfig().jwtSecret);
  } catch {
    return null;
  }
}

// ---------- Login ----------
// Login do admin (senha mestre) ou de um usuário compartilhado
function login(username, password) {
  if (!hasPassword()) {
    // Primeira execução: define a senha mestre
    setPassword(password);
    log('success', 'Senha mestre definida na primeira execução!');
    return { token: createToken('admin', 'admin'), user: { id: 'admin', username: 'admin', role: 'admin' }, firstLogin: true };
  }

  // Tentar admin
  if (verifyPassword(password)) {
    return { token: createToken('admin', 'admin'), user: { id: 'admin', username: 'admin', role: 'admin' }, firstLogin: false };
  }

  // Tentar usuários compartilhados
  const users = getUsers();
  for (const [id, u] of Object.entries(users)) {
    if (u.username === username && bcrypt.compareSync(password, u.passwordHash)) {
      return { token: createToken(id, u.role || 'user'), user: { id, username: u.username, role: u.role || 'user' }, firstLogin: false };
    }
  }
  return null;
}

// ---------- Middlewares ----------
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Token inválido ou expirado' });

  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  req.user = token ? verifyToken(token) : null;
  next();
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Acesso restrito ao administrador' });
}

// ---------- Usuários compartilhados ----------
function listUsers() {
  const users = getUsers();
  return Object.entries(users).map(([id, u]) => ({
    id,
    username: u.username,
    name: u.name || u.username,
    role: u.role || 'user',
    createdAt: u.createdAt,
    servers: u.servers || []
  }));
}

function addUser(username, name, password, role = 'user') {
  const users = getUsers();
  if (users[username]) return { error: 'Nome de usuário já existe' };
  users[username] = {
    username,
    name: name || username,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    createdAt: new Date().toISOString(),
    servers: []
  };
  saveUsers(users);
  log('success', `Usuário compartilhado criado: ${username}`);
  return { success: true, id: username };
}

function removeUser(username) {
  const users = getUsers();
  if (!users[username]) return { error: 'Usuário não encontrado' };
  delete users[username];
  saveUsers(users);
  return { success: true };
}

module.exports = {
  createToken, verifyToken, login,
  authenticateToken, optionalAuth, adminOnly,
  listUsers, addUser, removeUser, getUsers
};