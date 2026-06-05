const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const cfg = require('./config');
const dbm = require('./db');
const { get, all, run, insert } = dbm;
const auth = require('./auth');
const { genAvatarSvg } = require('./artgen');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

/* ---------------- uploads ---------------- */
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, dbm.UPLOAD_DIR); },
  filename: function (req, file, cb) {
    cb(null, crypto.randomBytes(10).toString('hex') + '.' + (EXT[file.mimetype] || 'bin'));
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: function (req, file, cb) {
    if (EXT[file.mimetype]) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
  }
});
// wrap multer so its errors become clean JSON instead of crashing the request
function uploadField(name) {
  return function (req, res, next) {
    upload.single(name)(req, res, function (err) {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}

/* ---------------- serializers ---------------- */
function countFollowers(id) { return get('SELECT COUNT(*) AS c FROM follows WHERE followee_id = ?', [id]).c; }
function countFollowing(id) { return get('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?', [id]).c; }
function countPosts(id) { return get('SELECT COUNT(*) AS c FROM posts WHERE user_id = ?', [id]).c; }

function publicUser(u, meId) {
  return {
    id: u.id, username: u.username, name: u.name, avatar: u.avatar,
    bio: { style: u.bio_style, medium: u.bio_medium, when: u.bio_when, mood: u.bio_mood },
    role: u.role, created: u.created,
    posts: countPosts(u.id), followers: countFollowers(u.id), following: countFollowing(u.id),
    isMe: meId === u.id,
    isFollowing: meId ? !!get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [meId, u.id]) : false
  };
}
function mapPost(r) {
  return {
    id: r.id, title: r.title, image: r.image, group: r.grp, shares: r.shares, created: r.created,
    author: { id: r.user_id, username: r.au_username, name: r.au_name, avatar: r.au_avatar },
    likes: r.like_count, liked: !!r.liked
  };
}
const POST_SELECT = `
  SELECT p.*, u.username AS au_username, u.name AS au_name, u.avatar AS au_avatar,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
  FROM posts p JOIN users u ON u.id = p.user_id`;

/* ---------------- attach user to every request ---------------- */
app.use(auth.attachUser);

/* ---------------- config ---------------- */
app.get('/api/config', function (req, res) {
  res.json({ groups: cfg.GROUPS, bioQuestions: cfg.BIO_QUESTIONS, badges: cfg.BADGES });
});

/* ---------------- auth ---------------- */
app.post('/api/auth/signup', uploadField('avatar'), function (req, res) {
  const username = (req.body.username || '').trim();
  const name = (req.body.name || '').trim().slice(0, 40) || username;
  const pass = req.body.password || '';
  let bio;
  try { bio = JSON.parse(req.body.bio || '{}'); } catch (e) { bio = {}; }

  if (!/^[a-zA-Z0-9_]{3,18}$/.test(username)) return res.status(400).json({ error: 'Username: 3–18 letters, numbers or _.' });
  if (pass.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!cfg.validBio(bio)) return res.status(400).json({ error: 'Please answer all four bio questions.' });
  if (get('SELECT 1 AS x FROM users WHERE username_lc = ?', [username.toLowerCase()]))
    return res.status(409).json({ error: 'That username is taken — try another!' });

  const avatar = req.file ? '/uploads/' + req.file.filename
                          : dbm.writeSvg('av_' + crypto.randomBytes(6).toString('hex') + '.svg', genAvatarSvg(username));
  const id = insert(
    'INSERT INTO users (username, username_lc, name, pass_hash, avatar, bio_style, bio_medium, bio_when, bio_mood, role, created) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [username, username.toLowerCase(), name, bcrypt.hashSync(pass, 10), avatar, bio.style, bio.medium, bio.when, bio.mood, 'user', Date.now()]);
  const u = get('SELECT * FROM users WHERE id = ?', [id]);
  auth.setAuthCookie(res, auth.sign(u));
  res.json({ user: publicUser(u, u.id) });
});

app.post('/api/auth/login', function (req, res) {
  const username = (req.body.username || '').trim();
  const pass = req.body.password || '';
  const u = get('SELECT * FROM users WHERE username_lc = ?', [username.toLowerCase()]);
  if (!u || !bcrypt.compareSync(pass, u.pass_hash)) return res.status(401).json({ error: 'Wrong username or password.' });
  auth.setAuthCookie(res, auth.sign(u));
  res.json({ user: publicUser(u, u.id) });
});

app.post('/api/auth/logout', function (req, res) { auth.clearAuthCookie(res); res.json({ ok: true }); });

app.get('/api/auth/me', function (req, res) {
  res.json({ user: req.user ? publicUser(req.user, req.user.id) : null });
});

/* ---------------- feed ---------------- */
app.get('/api/feed', function (req, res) {
  const me = req.user ? req.user.id : 0;
  let rows;
  if (req.query.mode === 'following' && req.user) {
    rows = all(POST_SELECT + ` WHERE p.user_id = ? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?) ORDER BY p.created DESC`,
      [me, me, me]);
  } else {
    rows = all(POST_SELECT + ' ORDER BY p.created DESC', [me]);
  }
  res.json({ posts: rows.map(mapPost) });
});

/* ---------------- groups ---------------- */
app.get('/api/groups', function (req, res) {
  const counts = {};
  all('SELECT grp, COUNT(*) AS c FROM posts GROUP BY grp').forEach(r => { counts[r.grp] = r.c; });
  res.json({ groups: cfg.GROUPS.map(g => Object.assign({}, g, { count: counts[g.id] || 0 })) });
});
app.get('/api/groups/:id/posts', function (req, res) {
  if (cfg.GROUP_IDS.indexOf(req.params.id) < 0) return res.status(404).json({ error: 'No such group.' });
  const me = req.user ? req.user.id : 0;
  const rows = all(POST_SELECT + ' WHERE p.grp = ? ORDER BY p.created DESC', [me, req.params.id]);
  res.json({ posts: rows.map(mapPost) });
});

/* ---------------- users / profiles ---------------- */
app.get('/api/users/:id', function (req, res) {
  const me = req.user ? req.user.id : null;
  const key = req.params.id;
  const u = /^\d+$/.test(key)
    ? get('SELECT * FROM users WHERE id = ?', [Number(key)])
    : get('SELECT * FROM users WHERE username_lc = ?', [key.toLowerCase()]);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const rows = all(POST_SELECT + ' WHERE p.user_id = ? ORDER BY p.created DESC', [me || 0, u.id]);
  res.json({ user: publicUser(u, me), posts: rows.map(mapPost) });
});

app.patch('/api/users/me', auth.requireAuth, uploadField('avatar'), function (req, res) {
  const u = req.user;
  const name = (req.body.name || u.name).trim().slice(0, 40) || u.username;
  let bio = null;
  if (req.body.bio) { try { bio = JSON.parse(req.body.bio); } catch (e) {} }
  if (bio && !cfg.validBio(bio)) return res.status(400).json({ error: 'Invalid bio answers.' });

  let avatar = u.avatar;
  if (req.file) {
    avatar = '/uploads/' + req.file.filename;
    if (u.avatar && u.avatar.indexOf('/uploads/') === 0) {
      try { fs.unlinkSync(path.join(dbm.UPLOAD_DIR, path.basename(u.avatar))); } catch (e) {}
    }
  }
  if (bio) {
    run('UPDATE users SET name = ?, avatar = ?, bio_style = ?, bio_medium = ?, bio_when = ?, bio_mood = ? WHERE id = ?',
      [name, avatar, bio.style, bio.medium, bio.when, bio.mood, u.id]);
  } else {
    run('UPDATE users SET name = ?, avatar = ? WHERE id = ?', [name, avatar, u.id]);
  }
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [u.id]), u.id) });
});

/* ---------------- posts ---------------- */
app.post('/api/posts', auth.requireAuth, uploadField('image'), function (req, res) {
  const title = (req.body.title || '').trim().slice(0, 80);
  const group = req.body.group || '';
  if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
  if (!title) { try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(400).json({ error: 'Give your artwork a title.' }); }
  if (cfg.GROUP_IDS.indexOf(group) < 0) { try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(400).json({ error: 'Pick a valid group.' }); }
  const id = insert('INSERT INTO posts (user_id, title, image, grp, shares, created) VALUES (?,?,?,?,?,?)',
    [req.user.id, title, '/uploads/' + req.file.filename, group, 0, Date.now()]);
  const row = get(POST_SELECT + ' WHERE p.id = ?', [req.user.id, id]);
  res.json({ post: mapPost(row) });
});

app.post('/api/posts/:id/like', auth.requireAuth, function (req, res) {
  const pid = Number(req.params.id);
  if (!get('SELECT 1 AS x FROM posts WHERE id = ?', [pid])) return res.status(404).json({ error: 'Post not found.' });
  const existing = get('SELECT 1 AS x FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, pid]);
  if (existing) run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, pid]);
  else run('INSERT INTO likes (user_id, post_id) VALUES (?,?)', [req.user.id, pid]);
  res.json({ liked: !existing, likes: get('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?', [pid]).c });
});

app.post('/api/posts/:id/share', auth.requireAuth, function (req, res) {
  const pid = Number(req.params.id);
  if (!get('SELECT 1 AS x FROM posts WHERE id = ?', [pid])) return res.status(404).json({ error: 'Post not found.' });
  run('UPDATE posts SET shares = shares + 1 WHERE id = ?', [pid]);
  res.json({ shares: get('SELECT shares FROM posts WHERE id = ?', [pid]).shares });
});

/* ---------------- follow ---------------- */
app.post('/api/users/:id/follow', auth.requireAuth, function (req, res) {
  const tid = Number(req.params.id);
  if (tid === req.user.id) return res.status(400).json({ error: 'You can\u2019t follow yourself.' });
  if (!get('SELECT 1 AS x FROM users WHERE id = ?', [tid])) return res.status(404).json({ error: 'User not found.' });
  const existing = get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [req.user.id, tid]);
  if (existing) run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', [req.user.id, tid]);
  else run('INSERT INTO follows (follower_id, followee_id) VALUES (?,?)', [req.user.id, tid]);
  res.json({ following: !existing, followers: countFollowers(tid) });
});

/* ---------------- admin ---------------- */
app.get('/api/admin/stats', auth.requireAdmin, function (req, res) {
  const users = get('SELECT COUNT(*) AS c FROM users').c;
  const posts = get('SELECT COUNT(*) AS c FROM posts').c;
  const likes = get('SELECT COUNT(*) AS c FROM likes').c;
  const shares = get('SELECT COALESCE(SUM(shares),0) AS c FROM posts').c;
  const activeGroups = get('SELECT COUNT(DISTINCT grp) AS c FROM posts').c;

  const perGroupRaw = {};
  all('SELECT grp, COUNT(*) AS c FROM posts GROUP BY grp').forEach(r => { perGroupRaw[r.grp] = r.c; });
  const perGroup = cfg.GROUPS.map(g => ({ id: g.id, label: g.emoji + ' ' + g.name.split(' ')[0], value: perGroupRaw[g.id] || 0 }))
    .sort((a, b) => b.value - a.value);

  const topCreators = all(
    'SELECT u.username, COUNT(p.id) AS c FROM users u LEFT JOIN posts p ON p.user_id = u.id GROUP BY u.id ORDER BY c DESC LIMIT 6')
    .map(r => ({ label: '@' + r.username, value: r.c }));

  const topPosts = all(POST_SELECT + ' ORDER BY like_count DESC, p.created DESC LIMIT 5', [0]).map(mapPost);

  // signups per day, last 7 days
  const day = 86400000, today = new Date(); today.setHours(0, 0, 0, 0);
  const signups = [];
  for (let d = 6; d >= 0; d--) {
    const start = today.getTime() - d * day, end = start + day;
    const c = get('SELECT COUNT(*) AS c FROM users WHERE created >= ? AND created < ?', [start, end]).c;
    const dt = new Date(start);
    signups.push({ label: (dt.getMonth() + 1) + '/' + dt.getDate(), value: c });
  }
  res.json({
    totals: { users, posts, likes, shares, activeGroups, totalGroups: cfg.GROUPS.length },
    perGroup, topCreators, topPosts, signups
  });
});

app.get('/api/admin/users', auth.requireAdmin, function (req, res) {
  const rows = all('SELECT * FROM users ORDER BY created ASC');
  res.json({ users: rows.map(u => ({
    id: u.id, username: u.username, name: u.name, avatar: u.avatar, role: u.role, created: u.created,
    posts: countPosts(u.id), followers: countFollowers(u.id)
  })) });
});

app.get('/api/admin/posts', auth.requireAdmin, function (req, res) {
  const rows = all(POST_SELECT + ' ORDER BY p.created DESC', [0]);
  res.json({ posts: rows.map(mapPost) });
});

app.delete('/api/admin/users/:id', auth.requireAdmin, function (req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You can\u2019t delete your own admin account.' });
  // remove their post images from disk
  all('SELECT image FROM posts WHERE user_id = ?', [id]).forEach(p => rmUpload(p.image));
  const u = get('SELECT avatar FROM users WHERE id = ?', [id]);
  if (u) rmUpload(u.avatar);
  run('DELETE FROM posts WHERE user_id = ?', [id]);
  run('DELETE FROM likes WHERE user_id = ?', [id]);
  run('DELETE FROM follows WHERE follower_id = ? OR followee_id = ?', [id, id]);
  run('DELETE FROM users WHERE id = ?', [id]);
  res.json({ ok: true });
});

app.delete('/api/admin/posts/:id', auth.requireAdmin, function (req, res) {
  const id = Number(req.params.id);
  const p = get('SELECT image FROM posts WHERE id = ?', [id]);
  if (p) rmUpload(p.image);
  run('DELETE FROM likes WHERE post_id = ?', [id]);
  run('DELETE FROM posts WHERE id = ?', [id]);
  res.json({ ok: true });
});

app.post('/api/admin/reset', auth.requireAdmin, function (req, res) {
  dbm.resetAll();
  res.json({ ok: true });
});

function rmUpload(p) {
  if (p && p.indexOf('/uploads/') === 0) {
    try { fs.unlinkSync(path.join(dbm.UPLOAD_DIR, path.basename(p))); } catch (e) {}
  }
}

/* ---------------- static + SPA ---------------- */
app.use('/uploads', express.static(dbm.UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

// admin page
app.get('/admin', function (req, res) { res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')); });

// SPA fallback for any non-API GET
app.get(/^(?!\/api\/).*/, function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// JSON 404 for unknown API routes
app.use('/api', function (req, res) { res.status(404).json({ error: 'Not found.' }); });

// central error handler
app.use(function (err, req, res, next) {
  console.error('Error on', req.method, req.url, '-', (err && err.message) || err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error.' });
});

/* ---------------- boot ---------------- */
dbm.initDb().then(function () {
  app.listen(PORT, function () { console.log('Art Peek running on http://localhost:' + PORT); });
}).catch(function (e) { console.error('Failed to start:', e); process.exit(1); });
