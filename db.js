const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { GROUP_IDS } = require('./config');
const { genArtSvg, genAvatarSvg } = require('./artgen');

// Storage locations. On a host like Render, point these at a mounted persistent
// disk via the DATA_DIR / UPLOAD_DIR environment variables. Locally they default
// to folders inside the project.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'artpeek.sqlite');

let db = null;
let SQL = null;
let saveTimer = null;

function ensureDirs() {
  [DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

// Persist the in-memory DB to disk (debounced to avoid thrashing on bursts).
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.writeFileSync(DB_FILE, Buffer.from(db.export())); }
    catch (e) { console.error('DB persist failed:', e.message); }
  }, 120);
}
function persistNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

/* ---- query helpers ---- */
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function get(sql, params = []) { return all(sql, params)[0] || null; }
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  persist();
}
function insert(sql, params = []) {
  run(sql, params);
  return get('SELECT last_insert_rowid() AS id').id;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_lc TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  avatar TEXT NOT NULL,
  bio_style TEXT, bio_medium TEXT, bio_when TEXT, bio_mood TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image TEXT NOT NULL,
  grp TEXT NOT NULL,
  shares INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL, followee_id INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);`;

function writeSvg(name, svg) {
  fs.writeFileSync(path.join(UPLOAD_DIR, name), svg);
  return '/uploads/' + name;
}

function seedIfEmpty() {
  const n = get('SELECT COUNT(*) AS c FROM users').c;
  if (n > 0) return;
  console.log('Seeding demo data…');
  const now = Date.now(), day = 86400000;

  // admin account (CHANGE THIS PASSWORD in production)
  insert('INSERT INTO users (username, username_lc, name, pass_hash, avatar, role, created) VALUES (?,?,?,?,?,?,?)',
    ['admin', 'admin', 'Site Admin', bcrypt.hashSync('admin', 10), writeSvg('av_admin.svg', genAvatarSvg('admin')), 'admin', now - 30 * day]);

  const people = [
    { u: 'pixelpanda',  n: 'Pixel Panda', bio: ['Pixel art', 'Digital tablet', 'It\u2019s late at night', 'Chaotic & fun'] },
    { u: 'lunadoodles', n: 'Luna',        bio: ['Doodly & loose', 'Pencil & paper', 'Music is playing', 'Soft & dreamy'] },
    { u: 'mango_art',   n: 'Mango',       bio: ['Cute & kawaii', 'Markers', 'The sun is up', 'Bold & bright'] },
    { u: 'inkwell',     n: 'Theo Ink',    bio: ['Anime / manga', 'Digital tablet', 'It\u2019s raining', 'Dark & moody'] },
    { u: 'sprout',      n: 'Robin Sprout',bio: ['Cartoony', 'Watercolour', 'I have a snack', 'Calm & cozy'] }
  ];
  const ids = [];
  people.forEach((p, i) => {
    const id = insert(
      'INSERT INTO users (username, username_lc, name, pass_hash, avatar, bio_style, bio_medium, bio_when, bio_mood, role, created) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [p.u, p.u.toLowerCase(), p.n, bcrypt.hashSync('demo', 10), writeSvg('av_' + p.u + '.svg', genAvatarSvg(p.u)),
       p.bio[0], p.bio[1], p.bio[2], p.bio[3], 'user', now - (12 - i * 2) * day]);
    ids.push(id);
  });

  // follows
  const F = [[0, 1], [0, 2], [1, 0], [1, 3], [1, 4], [2, 0], [3, 1], [3, 4]];
  F.forEach(([a, b]) => run('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)', [ids[a], ids[b]]));

  const titles = ['Sunset doodle', 'My cat as a wizard', 'Floating islands', 'Tiny robot pal', 'Glitch flower',
    'Cozy rainy day', 'Mecha sketch', 'Forest spirit', 'Pixel campfire', 'Dream clouds',
    'Star fox OC', 'Comic page 1', 'Underwater town', 'Lemon knight', 'Galaxy whale'];
  const ratios = [1, 1.3, 0.78, 1, 1.15, 0.85, 1.3, 1, 0.78, 1.2, 1, 0.9, 1.25, 1, 0.8];

  const postIds = [];
  titles.forEach((t, i) => {
    const owner = ids[i % ids.length];
    const img = writeSvg('seed_' + i + '.svg', genArtSvg('art_' + t + i, ratios[i % ratios.length]));
    const id = insert('INSERT INTO posts (user_id, title, image, grp, shares, created) VALUES (?,?,?,?,?,?)',
      [owner, t, img, GROUP_IDS[i % GROUP_IDS.length], (i * 37) % 14, now - ((i * 53) % 11) * day]);
    postIds.push(id);
  });

  // sprinkle likes
  postIds.forEach((pid, i) => {
    ids.forEach((uid, j) => {
      if (((i * 7 + j * 13) % 10) > 4) run('INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?,?)', [uid, pid]);
    });
  });

  persistNow();
  console.log('Seed complete.');
}

async function initDb() {
  ensureDirs();
  SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  seedIfEmpty();
  return db;
}

// Wipe everything (rows + uploaded files) and rebuild the demo content.
function resetAll() {
  ['likes', 'follows', 'posts', 'users'].forEach(t => db.run('DELETE FROM ' + t));
  db.run("DELETE FROM sqlite_sequence WHERE name IN ('users','posts')");
  try {
    fs.readdirSync(UPLOAD_DIR).forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (e) {} });
  } catch (e) {}
  seedIfEmpty();
  persistNow();
}

module.exports = {
  initDb, resetAll, seedIfEmpty, all, get, run, insert, persist, persistNow, writeSvg,
  UPLOAD_DIR, DATA_DIR
};
