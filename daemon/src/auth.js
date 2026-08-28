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
function login(username = 'admin', password) {
  const normUser = String(username || 'admin').trim().toLowerCase();

  if (!hasPassword()) {
    // Primeira execução: define a senha mestre
    setPassword(password);
    log('success', 'Senha mestre definida na primeira execução!');
    return {
      token: createToken(normUser || 'admin', 'admin'),
      user: { id: normUser || 'admin', username: normUser || 'admin', name: normUser === 'admin' ? 'Administrador' : username, role: 'admin' },
      firstLogin: true
    };
  }

  // Tentar admin (se o usuário for 'admin' ou se for uma tentativa padrão de admin)
  if (normUser === 'admin') {
    if (verifyPassword(password)) {
      return {
        token: createToken('admin', 'admin'),
        user: { id: 'admin', username: 'admin', name: 'Administrador', role: 'admin' },
        firstLogin: false
      };
    }
    return { error: 'Senha incorreta para o administrador' };
  }

  // Tentar usuários compartilhados
  const users = getUsers();
  for (const [id, u] of Object.entries(users)) {
    if (u.username.toLowerCase() === normUser) {
      if (bcrypt.compareSync(password, u.passwordHash)) {
        return {
          token: createToken(id, u.role || 'user'),
          user: { id, username: u.username, name: u.name || u.username, role: u.role || 'user' },
          firstLogin: false
        };
      }
      return { error: 'Senha incorreta' };
    }
  }

  // Se o usuário não for encontrado nos compartilhados, mas a senha for a do admin e o nome for vago, loga como admin
  if (verifyPassword(password)) {
    return {
      token: createToken('admin', 'admin'),
      user: { id: 'admin', username: 'admin', name: 'Administrador', role: 'admin' },
      firstLogin: false
    };
  }

  return { error: 'Usuário não encontrado' };
}

// ---------- Registro ----------
function register(username, password, name = '') {
  const normUser = String(username || '').trim();
  if (!normUser) return { error: 'Nome de usuário é obrigatório' };
  if (normUser.length < 3) return { error: 'O usuário deve ter no mínimo 3 caracteres' };
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(normUser)) {
    return { error: 'O nome de usuário só pode conter letras, números, pontos, hífens e sublinhados' };
  }
  if (!password || password.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres' };
  }

  // Se não foi configurado ainda, este primeiro registro cria o Administrador Mestre
  if (!hasPassword()) {
    setPassword(password);
    log('success', `Administrador inicial registrado: ${normUser}`);
    return {
      token: createToken(normUser, 'admin'),
      user: { id: normUser, username: normUser, name: name || normUser, role: 'admin' },
      firstLogin: true
    };
  }

  if (normUser.toLowerCase() === 'admin') {
    return { error: 'O nome "admin" está reservado para o administrador principal' };
  }

  const users = getUsers();
  for (const [, u] of Object.entries(users)) {
    if (u.username.toLowerCase() === normUser.toLowerCase()) {
      return { error: 'Este nome de usuário já está em uso' };
    }
  }

  users[normUser] = {
    username: normUser,
    name: name || normUser,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user',
    createdAt: new Date().toISOString(),
    servers: []
  };
  saveUsers(users);
  log('success', `Novo usuário registrado com sucesso: ${normUser}`);

  return {
    token: createToken(normUser, 'user'),
    user: { id: normUser, username: normUser, name: name || normUser, role: 'user' },
    firstLogin: false
  };
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
  createToken, verifyToken, login, register,
  authenticateToken, optionalAuth, adminOnly,
  listUsers, addUser, removeUser, getUsers
};