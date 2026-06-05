/* ============================================================
   Art Peek — main app (single page, hash routed, API-backed)
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var E = AP.esc, ICON = AP.icon, API = AP.API;

  var authEl = $('#auth');
  var appEl  = $('#app');
  var me = null;                 // current user (or null)
  var feedMode = 'all';
  var postCache = {};            // id -> post, for the modal

  AP.Theme.apply();

  /* =========================================================
     AUTH SCREEN
     ========================================================= */
  function bioSelect(qid, q, opts, current) {
    var o = '<option value="" disabled ' + (current ? '' : 'selected') + '>Choose one…</option>';
    o += opts.map(function (x) { return '<option' + (current === x ? ' selected' : '') + '>' + E(x) + '</option>'; }).join('');
    return '<div class="field"><label>' + E(q) + '</label><select data-bio="' + qid + '">' + o + '</select></div>';
  }

  function renderAuth(tab) {
    tab = tab || 'login';
    var doodles =
      '<img class="float-doodle" src="assets/doodle-diamonds.png" style="top:8%;left:6%;width:70px;transform:rotate(-12deg)">' +
      '<img class="float-doodle" src="assets/doodle-arrow.png" style="bottom:12%;left:10%;width:120px;transform:rotate(8deg)">' +
      '<img class="float-doodle" src="assets/doodle-triangle.png" style="top:14%;right:9%;width:64px;transform:rotate(14deg)">' +
      '<img class="float-doodle" src="assets/doodle-scribble.png" style="bottom:16%;right:7%;width:200px;transform:rotate(-6deg)">' +
      '<img class="float-doodle" src="assets/doodle-face.png" style="bottom:38%;left:3%;width:80px;transform:rotate(6deg)">';

    var tabs = '<div class="auth-tabs">' +
      '<button class="btn ' + (tab === 'login' ? 'active' : '') + '" data-tab="login">Log in</button>' +
      '<button class="btn ' + (tab === 'signup' ? 'active' : '') + '" data-tab="signup">Sign up</button></div>';

    var body;
    if (tab === 'login') {
      body =
        '<div class="field"><label>Username</label><input class="input" id="li-user" placeholder="e.g. pixelpanda" autocomplete="username"></div>' +
        '<div class="field"><label>Password</label><input class="input" id="li-pass" type="password" placeholder="••••••" autocomplete="current-password"></div>' +
        '<div class="err" id="li-err"></div>' +
        '<button class="btn block dark" id="li-go">Let me in! ' + ICON('check') + '</button>' +
        '<p class="hint" style="text-align:center;margin-top:1rem">Demo account — user <b>pixelpanda</b>, password <b>demo</b></p>';
    } else {
      body =
        '<div class="field"><label>Profile picture</label><div class="ava-upload">' +
          '<img class="ava-prev" id="su-ava" alt="">' +
          '<div><button class="btn sm ghost" id="su-ava-btn" type="button">Upload photo</button>' +
          '<input type="file" accept="image/*" id="su-ava-file" hidden>' +
          '<p class="hint">Optional — we\u2019ll doodle one for you!</p></div>' +
        '</div></div>' +
        '<div class="field"><label>Display name</label><input class="input" id="su-name" placeholder="What should we call you?"></div>' +
        '<div class="field"><label>Username</label><input class="input" id="su-user" placeholder="pick a unique @name" autocomplete="off"></div>' +
        '<div class="field"><label>Password</label><input class="input" id="su-pass" type="password" placeholder="at least 6 characters" autocomplete="new-password"></div>' +
        '<h3 style="margin:1.4rem 0 .6rem;font-size:1.1rem">Your mini bio ✨</h3>' +
        AP.cfg.bioQuestions.map(function (b) { return bioSelect(b.id, b.q, b.opts); }).join('') +
        '<div class="err" id="su-err"></div>' +
        '<button class="btn block dark" id="su-go">Create my profile! ' + ICON('check') + '</button>';
    }

    authEl.innerHTML =
      '<div class="auth-stage">' + doodles +
        '<div class="auth-card card"><div class="pad">' +
          '<img class="auth-logo" src="assets/logo-green.png" alt="Art Peek">' +
          tabs + body +
        '</div></div>' +
      '</div>';
    authEl.classList.remove('hidden');
    appEl.classList.add('hidden');

    var avatarFile = null;
    if (tab === 'signup') {
      var prev = $('#su-ava');
      prev.src = 'assets/icon.png';  // placeholder until upload (server makes the real default)
      prev.style.objectFit = 'contain'; prev.style.background = 'var(--green)';
      $('#su-ava-btn').onclick = function () { $('#su-ava-file').click(); };
      $('#su-ava-file').onchange = function (e) {
        var f = e.target.files[0]; if (!f) return;
        avatarFile = f;
        var rd = new FileReader(); rd.onload = function (ev) { prev.src = ev.target.result; prev.style.objectFit = 'cover'; }; rd.readAsDataURL(f);
      };
      $('#su-go').onclick = async function () {
        var err = $('#su-err'); err.textContent = '';
        var btn = $('#su-go'); btn.disabled = true;
        try {
          var bio = {}; var missing = false;
          document.querySelectorAll('[data-bio]').forEach(function (s) { if (!s.value) missing = true; bio[s.getAttribute('data-bio')] = s.value; });
          if (missing) throw new Error('Please answer all four bio questions.');
          var fd = new FormData();
          fd.append('username', $('#su-user').value.trim());
          fd.append('name', $('#su-name').value.trim());
          fd.append('password', $('#su-pass').value);
          fd.append('bio', JSON.stringify(bio));
          if (avatarFile) {
            var blob = await AP.resizeToBlob(avatarFile, 400);
            fd.append('avatar', blob, 'avatar.jpg');
          }
          var r = await API.signup(fd);
          me = r.user;
          AP.toast('Welcome to Art Peek, ' + me.name + '! 🎉');
          location.hash = '#/feed'; showApp();
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
      };
    } else {
      $('#li-go').onclick = async function () {
        var err = $('#li-err'); err.textContent = '';
        var btn = $('#li-go'); btn.disabled = true;
        try { var r = await API.login($('#li-user').value.trim(), $('#li-pass').value); me = r.user; location.hash = '#/feed'; showApp(); }
        catch (ex) { err.textContent = ex.message; btn.disabled = false; }
      };
      $('#li-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#li-go').click(); });
    }

    authEl.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { renderAuth(b.getAttribute('data-tab')); }; });
  }

  /* =========================================================
     NAV
     ========================================================= */
  function renderNav() {
    var h = location.hash || '#/feed';
    function link(href, name, label) {
      var active = h.indexOf(href) === 0 ? 'active' : '';
      return '<a class="nav-link ' + active + '" href="' + href + '">' + ICON(name) + '<span>' + label + '</span></a>';
    }
    return '<nav class="nav"><div class="nav-inner">' +
      '<img class="logo" src="assets/logo-white.png" alt="Art Peek" data-nav-home>' +
      '<div class="nav-spacer"></div>' +
      '<div class="nav-links">' +
        link('#/feed', 'home', 'Feed') +
        link('#/groups', 'grid', 'Groups') +
        link('#/upload', 'upload', 'Upload') +
        '<button class="nav-link" data-theme-btn title="Switch theme">' + ICON('palette') + '<span>Theme</span></button>' +
        '<button class="nav-link" data-logout title="Log out">' + ICON('logout') + '</button>' +
        '<img class="nav-ava" src="' + E(me.avatar) + '" data-nav-me title="My profile">' +
      '</div>' +
    '</div></nav>';
  }

  /* =========================================================
     SHARED PIECES
     ========================================================= */
  function postCard(p) {
    postCache[p.id] = p;
    var g = AP.groupById(p.group);
    return '<article class="post">' +
      '<img class="art" src="' + E(p.image) + '" data-open="' + p.id + '" alt="' + E(p.title) + '" loading="lazy">' +
      '<div class="meta">' +
        '<div class="ptitle">' + E(p.title) + '</div>' +
        '<div class="byline" data-gouser="' + p.author.id + '"><img src="' + E(p.author.avatar) + '"><b>' + E(p.author.name) + '</b></div>' +
        (g ? '<span class="grp-tag" data-gogroup="' + g.id + '">' + g.emoji + ' ' + E(g.name) + '</span><br>' : '') +
        '<div class="actions">' +
          '<button class="act ' + (p.liked ? 'liked' : '') + '" data-like="' + p.id + '">' + ICON('heart') + '<span>' + p.likes + '</span></button>' +
          '<button class="act" data-share="' + p.id + '">' + ICON('share') + '<span>' + p.shares + '</span></button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
  function masonry(posts, emptyTitle, emptyMsg) {
    if (!posts.length) return emptyState(emptyTitle, emptyMsg);
    return '<div class="masonry">' + posts.map(postCard).join('') + '</div>';
  }
  function emptyState(title, msg) {
    return '<div class="empty"><img src="assets/doodle-face.png"><h3>' + E(title) + '</h3><p>' + E(msg) + '</p></div>';
  }
  function wrap(inner) { return '<div class="wrap">' + inner + '</div>'; }
  function shell(body) { appEl.innerHTML = renderNav() + body + '<div class="foot">Made with doodles 🖍️ · Art Peek</div>'; }

  /* =========================================================
     VIEWS  (each returns HTML string; data fetched first)
     ========================================================= */
  async function viewFeed() {
    var r = await API.feed(feedMode);
    var seg = '<div class="seg">' +
      '<button class="' + (feedMode === 'all' ? 'on' : '') + '" data-feedmode="all">Everyone</button>' +
      '<button class="' + (feedMode === 'following' ? 'on' : '') + '" data-feedmode="following">Following</button></div>';
    var grid = masonry(r.posts,
      feedMode === 'following' ? 'Nothing here yet' : 'No art yet',
      feedMode === 'following' ? 'Follow some artists to fill your feed!' : 'Be the first to upload something!');
    return wrap('<div class="page-head"><h1>The Feed</h1><div class="nav-spacer"></div>' + seg + '</div>' + grid);
  }

  async function viewGroups() {
    var r = await API.groups();
    var cards = r.groups.map(function (g) {
      return '<div class="group-card card" data-gogroup="' + g.id + '">' +
        '<div class="group-banner" style="background:' + g.color + '">' + g.emoji + '</div>' +
        '<div class="pad"><h3>' + E(g.name) + '</h3><p>' + E(g.desc) + '</p>' +
        '<div class="count">' + g.count + ' artwork' + (g.count === 1 ? '' : 's') + '</div></div></div>';
    }).join('');
    return wrap('<div class="page-head"><h1>Groups</h1><span class="sub">Find your crowd ✨</span></div>' +
      '<div class="group-grid">' + cards + '</div>');
  }

  async function viewGroup(id) {
    var g = AP.groupById(id);
    if (!g) return viewGroups();
    var r = await API.groupPosts(id);
    return wrap('<div class="page-head"><a class="btn sm ghost" href="#/groups">← Groups</a><h1>' + g.emoji + ' ' + E(g.name) + '</h1></div>' +
      '<p class="sub" style="margin:-.8rem 0 1.2rem">' + E(g.desc) + '</p>' +
      masonry(r.posts, 'Empty group', 'No one has posted to ' + g.name + ' yet — you could be first!'));
  }

  async function viewProfile(idOrUsername) {
    var r = await API.user(idOrUsername || me.username);
    var u = r.user, posts = r.posts;
    var bio = AP.cfg.bioQuestions.map(function (b) {
      var a = (u.bio || {})[b.id] || '—';
      return '<div class="bio-item"><div class="q">' + E(b.q) + '</div><div class="a">' + E(a) + '</div></div>';
    }).join('');
    var badges = AP.badgesFor(u.posts).map(function (b) {
      return '<span class="badge ' + (b.unlocked ? '' : 'locked') + '" title="' + (b.unlocked ? 'Unlocked!' : 'Upload ' + b.min + ' artworks') + '">' +
        '<span class="e">' + b.emoji + '</span>' + E(b.name) + '</span>';
    }).join('');
    var actions = u.isMe
      ? '<a class="btn ghost" href="#/edit">Edit profile</a>'
      : '<button class="btn ' + (u.isFollowing ? 'ghost' : '') + '" data-follow="' + u.id + '">' + (u.isFollowing ? 'Following ✓' : '+ Follow') + '</button>';

    return wrap(
      '<div class="card pad">' +
        '<div class="profile-top">' +
          '<img class="profile-ava" src="' + E(u.avatar) + '" alt="">' +
          '<div class="profile-info">' +
            '<h2>' + E(u.name) + '</h2>' +
            '<div class="sub" style="color:var(--ink-soft);font-weight:800">@' + E(u.username) + (u.role === 'admin' ? ' · 🛡️ admin' : '') + '</div>' +
            '<div class="profile-stats">' +
              '<div class="stat"><b>' + u.posts + '</b><span>artworks</span></div>' +
              '<div class="stat"><b>' + u.followers + '</b><span>followers</span></div>' +
              '<div class="stat"><b>' + u.following + '</b><span>following</span></div>' +
            '</div>' + actions +
            '<div class="badges" style="margin-top:1.1rem">' + badges + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bio-grid">' + bio + '</div>' +
      '</div>' +
      '<div class="section-title">' + (u.isMe ? 'My artwork' : E(u.name) + '\u2019s artwork') + '</div>' +
      masonry(posts, 'No artwork yet', u.isMe ? 'Upload your first piece!' : u.name + ' hasn\u2019t posted yet.'));
  }

  function viewEdit() {
    var selects = AP.cfg.bioQuestions.map(function (b) { return bioSelect(b.id, b.q, b.opts, (me.bio || {})[b.id]); }).join('');
    return wrap('<div class="page-head"><a class="btn sm ghost" href="#/profile">← Profile</a><h1>Edit profile</h1></div>' +
      '<div class="card pad" style="max-width:560px">' +
        '<div class="field"><label>Profile picture</label><div class="ava-upload">' +
          '<img class="ava-prev" id="ed-ava" src="' + E(me.avatar) + '">' +
          '<div><button class="btn sm ghost" id="ed-ava-btn" type="button">Change photo</button>' +
          '<input type="file" accept="image/*" id="ed-ava-file" hidden></div>' +
        '</div></div>' +
        '<div class="field"><label>Display name</label><input class="input" id="ed-name" value="' + E(me.name) + '"></div>' +
        '<h3 style="margin:1.2rem 0 .6rem;font-size:1.1rem">Mini bio</h3>' + selects +
        '<div class="err" id="ed-err"></div>' +
        '<button class="btn dark" id="ed-save">Save changes ' + ICON('check') + '</button>' +
      '</div>');
  }

  function viewUpload() {
    var groupOpts = AP.cfg.groups.map(function (g) { return '<option value="' + g.id + '">' + g.emoji + ' ' + E(g.name) + '</option>'; }).join('');
    return wrap('<div class="page-head"><h1>Upload artwork</h1></div>' +
      '<div class="card pad" style="max-width:560px">' +
        '<div class="field"><label>Your artwork</label>' +
          '<div class="drop" id="up-drop"><div id="up-drop-inner"><b style="font-family:Fredoka">Tap to choose an image</b>' +
          '<p class="hint">JPG, PNG, WEBP or GIF — big files are shrunk automatically</p></div></div>' +
          '<input type="file" accept="image/*" id="up-file" hidden></div>' +
        '<div class="field"><label>Title</label><input class="input" id="up-title" placeholder="Give it a name"></div>' +
        '<div class="field"><label>Post to group</label><select id="up-group"><option value="" disabled selected>Choose a group…</option>' + groupOpts + '</select></div>' +
        '<div class="err" id="up-err"></div>' +
        '<button class="btn dark block" id="up-go">Share it! ' + ICON('upload') + '</button>' +
      '</div>');
  }

  /* post modal */
  function openPost(id) {
    var p = postCache[id];
    if (!p) return;
    var g = AP.groupById(p.group);
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML =
      '<div class="modal card" style="position:relative">' +
        '<button class="btn sm dark close" data-close>' + ICON('x') + '</button>' +
        '<div class="m-art"><img src="' + E(p.image) + '"></div>' +
        '<div class="m-side">' +
          '<div class="byline" data-gouser="' + p.author.id + '" style="cursor:pointer;display:flex;align-items:center;gap:.5rem;margin-bottom:.8rem">' +
            '<img src="' + E(p.author.avatar) + '" style="width:38px;height:38px;border-radius:50%;border:2.5px solid var(--ink);object-fit:cover">' +
            '<b style="font-family:Fredoka;font-size:1.05rem">' + E(p.author.name) + '</b></div>' +
          '<h2 style="margin:.2rem 0 .4rem">' + E(p.title) + '</h2>' +
          (g ? '<span class="grp-tag" data-gogroup="' + g.id + '">' + g.emoji + ' ' + E(g.name) + '</span>' : '') +
          '<p class="hint" style="margin:.7rem 0 1.1rem">Posted ' + AP.timeAgo(p.created) + '</p>' +
          '<div class="actions">' +
            '<button class="act ' + (p.liked ? 'liked' : '') + '" data-like="' + p.id + '">' + ICON('heart') + '<span>' + p.likes + '</span></button>' +
            '<button class="act" data-share="' + p.id + '">' + ICON('share') + '<span>' + p.shares + '</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    back.addEventListener('click', function (e) { if (e.target === back || e.target.closest('[data-close]')) back.remove(); });
    document.body.appendChild(back);
  }

  /* =========================================================
     ROUTER
     ========================================================= */
  async function render() {
    if (!me) { renderAuth('login'); return; }
    authEl.classList.add('hidden'); appEl.classList.remove('hidden');

    var hash = location.hash.replace(/^#/, '') || '/feed';
    var parts = hash.split('/').filter(Boolean);
    try {
      var body;
      switch (parts[0]) {
        case 'feed':    body = await viewFeed(); break;
        case 'groups':  body = await viewGroups(); break;
        case 'group':   body = await viewGroup(parts[1]); break;
        case 'profile': body = await viewProfile(null); break;
        case 'user':    body = await viewProfile(parts[1]); break;
        case 'edit':    body = viewEdit(); break;
        case 'upload':  body = viewUpload(); break;
        default:        body = await viewFeed();
      }
      shell(body);
      wireView(parts[0]);
    } catch (ex) {
      shell(wrap(emptyState('Hmm…', ex.message)));
    }
  }

  function wireView(view) {
    if (view === 'edit') {
      var avatarFile = null;
      $('#ed-ava-btn').onclick = function () { $('#ed-ava-file').click(); };
      $('#ed-ava-file').onchange = function (e) {
        var f = e.target.files[0]; if (!f) return; avatarFile = f;
        var rd = new FileReader(); rd.onload = function (ev) { $('#ed-ava').src = ev.target.result; }; rd.readAsDataURL(f);
      };
      $('#ed-save').onclick = async function () {
        var err = $('#ed-err'); err.textContent = ''; var btn = $('#ed-save'); btn.disabled = true;
        try {
          var bio = {};
          document.querySelectorAll('[data-bio]').forEach(function (s) { if (s.value) bio[s.getAttribute('data-bio')] = s.value; });
          var fd = new FormData();
          fd.append('name', $('#ed-name').value.trim());
          fd.append('bio', JSON.stringify(bio));
          if (avatarFile) { var blob = await AP.resizeToBlob(avatarFile, 400); fd.append('avatar', blob, 'avatar.jpg'); }
          var r = await API.updateMe(fd); me = r.user;
          AP.toast('Profile saved! ✨'); location.hash = '#/profile';
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
      };
    }
    if (view === 'upload') {
      var file = null;
      var drop = $('#up-drop'), inner = $('#up-drop-inner');
      drop.onclick = function () { $('#up-file').click(); };
      $('#up-file').onchange = function (e) {
        var f = e.target.files[0]; if (!f) return; file = f;
        var rd = new FileReader(); rd.onload = function (ev) { drop.classList.add('has'); inner.innerHTML = '<img src="' + ev.target.result + '">'; }; rd.readAsDataURL(f);
      };
      $('#up-go').onclick = async function () {
        var err = $('#up-err'); err.textContent = ''; var btn = $('#up-go');
        try {
          if (!file) throw new Error('Please choose an image first.');
          if (!$('#up-title').value.trim()) throw new Error('Give your artwork a title.');
          if (!$('#up-group').value) throw new Error('Pick a group to post to.');
          btn.disabled = true;
          var blob = await AP.resizeToBlob(file, 1200);
          var fd = new FormData();
          fd.append('image', blob, 'art.jpg');
          fd.append('title', $('#up-title').value.trim());
          fd.append('group', $('#up-group').value);
          await API.createPost(fd);
          AP.toast('Posted! 🎨'); location.hash = '#/profile';
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
      };
    }
  }

  /* =========================================================
     GLOBAL CLICK DELEGATION
     ========================================================= */
  document.addEventListener('click', async function (e) {
    var el;
    if ((el = e.target.closest('[data-like]'))) {
      var id = Number(el.getAttribute('data-like'));
      try {
        var r = await API.like(id);
        if (postCache[id]) { postCache[id].liked = r.liked; postCache[id].likes = r.likes; }
        document.querySelectorAll('[data-like="' + id + '"]').forEach(function (b) {
          b.classList.toggle('liked', r.liked); b.querySelector('span').textContent = r.likes;
        });
      } catch (ex) { AP.toast(ex.message); }
      return;
    }
    if ((el = e.target.closest('[data-share]'))) {
      var sid = Number(el.getAttribute('data-share'));
      try {
        var rs = await API.share(sid);
        if (postCache[sid]) postCache[sid].shares = rs.shares;
        document.querySelectorAll('[data-share="' + sid + '"] span').forEach(function (s) { s.textContent = rs.shares; });
        var link = location.origin + location.pathname + '#/user/' + (postCache[sid] ? postCache[sid].author.id : '');
        if (navigator.clipboard) navigator.clipboard.writeText(link).catch(function () {});
        AP.toast('Link copied — share away! 🔗');
      } catch (ex) { AP.toast(ex.message); }
      return;
    }
    if ((el = e.target.closest('[data-follow]'))) {
      var fid = Number(el.getAttribute('data-follow'));
      try { await API.follow(fid); render(); } catch (ex) { AP.toast(ex.message); }
      return;
    }
    if ((el = e.target.closest('[data-open]')))    { openPost(Number(el.getAttribute('data-open'))); return; }
    if ((el = e.target.closest('[data-gouser]')))  { location.hash = '#/user/' + el.getAttribute('data-gouser'); closeModal(); return; }
    if ((el = e.target.closest('[data-gogroup]'))) { location.hash = '#/group/' + el.getAttribute('data-gogroup'); closeModal(); return; }
    if ((el = e.target.closest('[data-feedmode]'))){ feedMode = el.getAttribute('data-feedmode'); render(); return; }
    if (e.target.closest('[data-nav-home]'))       { location.hash = '#/feed'; return; }
    if (e.target.closest('[data-nav-me]'))         { location.hash = '#/profile'; return; }
    if (e.target.closest('[data-theme-btn]'))      { AP.toast('Theme ' + AP.Theme.cycle() + ' 🎨'); return; }
    if (e.target.closest('[data-logout]'))         { await API.logout(); me = null; location.hash = ''; renderAuth('login'); return; }
  });
  function closeModal() { var m = $('.modal-back'); if (m) m.remove(); }

  /* =========================================================
     BOOT
     ========================================================= */
  function showApp() { render(); }
  window.addEventListener('hashchange', function () { closeModal(); if (me) render(); });

  (async function boot() {
    try { await AP.loadConfig(); } catch (e) {}
    try { var r = await API.me(); me = r.user; } catch (e) { me = null; }
    if (me) { if (!location.hash) location.hash = '#/feed'; render(); }
    else { renderAuth('login'); }
  })();
})();
