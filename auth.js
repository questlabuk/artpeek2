const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { get, DATA_DIR } = require('./db');

const SECRET_FILE = path.join(DATA_DIR, '.jwt_secret');
const COOKIE = 'ap_token';
const MAX_AGE = 7 * 24 * 3600 * 1000; // 7 days

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try { return fs.readFileSync(SECRET_FILE, 'utf8'); }
  catch (e) {
    const s = crypto.randomBytes(48).toString('hex');
    try { fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 }); } catch (_) {}
    return s;
  }
}
let SECRET = null;
function secret() { if (!SECRET) SECRET = loadSecret(); return SECRET; }

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, secret(), { expiresIn: '7d' });
}
function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/'
  });
}
function clearAuthCookie(res) { res.clearCookie(COOKIE, { path: '/' }); }

// Reads the cookie, verifies it, attaches the full (fresh) user row as req.user.
function attachUser(req, res, next) {
  req.user = null;
  const tok = req.cookies && req.cookies[COOKIE];
  if (tok) {
    try {
      const payload = jwt.verify(tok, secret());
      const u = get('SELECT * FROM users WHERE id = ?', [payload.id]);
      if (u) req.user = u;
    } catch (e) { /* invalid/expired token -> anonymous */ }
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

module.exports = { sign, setAuthCookie, clearAuthCookie, attachUser, requireAuth, requireAdmin, COOKIE };
