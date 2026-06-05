/* ============================================================
   Art Peek — admin dashboard (/admin)
   Real auth: requires logging in as a user whose role is 'admin'.
   All data comes from /api/admin/* (server enforces the role).
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var E = AP.esc, ICON = AP.icon, API = AP.API;
  var root = $('#admin-root');

  AP.Theme.apply();

  /* ---- login gate (real credentials) ---- */
  function gate(msg) {
    root.innerHTML =
      '<div class="admin-gate"><div class="card pad">' +
        '<img src="../assets/logo-green.png" style="height:48px;margin:0 auto 1rem">' +
        '<h2 style="text-align:center;margin:.2rem 0 1rem;font-family:Fredoka">Admin sign in</h2>' +
        '<div class="field"><label>Username</label><input class="input" id="g-user" autocomplete="username"></div>' +
        '<div class="field"><label>Password</label><input class="input" id="g-pass" type="password" autocomplete="current-password"></div>' +
        '<div class="err" id="g-err">' + (msg || '') + '</div>' +
        '<button class="btn dark block" id="g-go">Sign in</button>' +
        '<p class="hint" style="text-align:center;margin-top:.9rem">Demo admin — user <b>admin</b>, password <b>admin</b></p>' +
      '</div></div>';
    $('#g-go').onclick = async function () {
      var err = $('#g-err'); err.textContent = ''; var btn = $('#g-go'); btn.disabled = true;
      try {
        await API.login($('#g-user').value.trim(), $('#g-pass').value);
        await start();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
    $('#g-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#g-go').click(); });
  }

  function bar(rows, color) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    return rows.map(function (r) {
      return '<div class="bar-row"><span>' + E(r.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (r.value / max * 100) + '%;background:' + (color || 'var(--green)') + '"></span></span>' +
        '<span class="v">' + r.value + '</span></div>';
    }).join('');
  }

  async function dashboard() {
    var s = await API.admin.stats();
    var uu = await API.admin.users();
    var pp = await API.admin.posts();
    var t = s.totals;

    function sc(n, l, ic) { return '<div class="stat-card"><span class="ic">' + ic + '</span><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }
    var cards =
      sc(t.users, 'Users', '👥') + sc(t.posts, 'Artworks', '🖼️') +
      sc(t.likes, 'Total likes', '❤️') + sc(t.shares, 'Total shares', '🔗') +
      sc(t.activeGroups + '/' + t.totalGroups, 'Active groups', '📁');

    var topPostsHtml = s.topPosts.length ? s.topPosts.map(function (p) {
      return '<div class="bar-row" style="grid-template-columns:46px 1fr auto;gap:.7rem">' +
        '<img class="pthumb" src="' + E(p.image) + '">' +
        '<span><b>' + E(p.title) + '</b><br><span class="muted" style="font-size:.8rem">@' + E(p.author.username) + '</span></span>' +
        '<span class="v" style="font-family:Fredoka">❤ ' + p.likes + '</span></div>';
    }).join('') : '<p class="muted">No posts yet.</p>';

    var userRows = uu.users.map(function (u) {
      return '<tr><td><img class="uava" src="' + E(u.avatar) + '"></td>' +
        '<td><b>' + E(u.name) + '</b>' + (u.role === 'admin' ? ' 🛡️' : '') + '</td>' +
        '<td class="muted">@' + E(u.username) + '</td>' +
        '<td>' + u.posts + '</td><td>' + u.followers + '</td>' +
        '<td class="muted">' + new Date(u.created).toLocaleDateString() + '</td>' +
        '<td>' + (u.role === 'admin' ? '' : '<button class="del-btn" data-deluser="' + u.id + '" title="Delete user">' + ICON('trash') + '</button>') + '</td></tr>';
    }).join('');

    var postRows = pp.posts.map(function (p) {
      var g = AP.groupById(p.group) || { name: '—', emoji: '' };
      return '<tr><td><img class="pthumb" src="' + E(p.image) + '"></td>' +
        '<td><b>' + E(p.title) + '</b></td>' +
        '<td class="muted">@' + E(p.author.username) + '</td>' +
        '<td>' + g.emoji + ' ' + E(g.name) + '</td>' +
        '<td>❤ ' + p.likes + '</td><td>🔗 ' + p.shares + '</td>' +
        '<td class="muted">' + new Date(p.created).toLocaleDateString() + '</td>' +
        '<td><button class="del-btn" data-delpost="' + p.id + '" title="Delete post">' + ICON('trash') + '</button></td></tr>';
    }).join('');

    root.innerHTML =
      '<div class="admin-bar"><div class="nav-inner">' +
        '<img class="logo" src="../assets/logo-white.png"><span class="tag">ADMIN</span>' +
        '<div class="nav-spacer"></div>' +
        '<a class="back" href="../index.html">← Back to site</a>' +
        '<button class="btn sm ghost" id="a-logout">Log out</button>' +
      '</div></div>' +
      '<div class="admin-wrap">' +
        '<h1>Dashboard</h1>' +
        '<div class="stat-cards">' + cards + '</div>' +
        '<h2>Analytics</h2>' +
        '<div class="two-col">' +
          '<div class="panel"><h3>Artworks per group</h3>' + bar(s.perGroup) + '</div>' +
          '<div class="panel"><h3>Top creators</h3>' + bar(s.topCreators, 'var(--tag)') + '</div>' +
        '</div>' +
        '<div class="two-col" style="margin-top:1.2rem">' +
          '<div class="panel"><h3>Signups (last 7 days)</h3>' + bar(s.signups, 'var(--tag2)') + '</div>' +
          '<div class="panel"><h3>Most-liked artworks</h3>' + topPostsHtml + '</div>' +
        '</div>' +
        '<h2>Users <span class="muted" style="font-size:.9rem">(' + t.users + ')</span></h2>' +
        '<div class="panel scroll-x"><table class="admin"><thead><tr>' +
          '<th></th><th>Name</th><th>Username</th><th>Posts</th><th>Followers</th><th>Joined</th><th></th>' +
        '</tr></thead><tbody>' + userRows + '</tbody></table></div>' +
        '<h2>Posts <span class="muted" style="font-size:.9rem">(' + t.posts + ')</span></h2>' +
        '<div class="panel scroll-x"><table class="admin"><thead><tr>' +
          '<th></th><th>Title</th><th>Artist</th><th>Group</th><th>Likes</th><th>Shares</th><th>Date</th><th></th>' +
        '</tr></thead><tbody>' + (postRows || '<tr><td colspan="8" class="muted">No posts.</td></tr>') + '</tbody></table></div>' +
        '<h2>Maintenance</h2>' +
        '<div class="panel"><p class="muted" style="margin-top:0">Reset clears all users &amp; posts and restores the demo content.</p>' +
        '<button class="btn ghost" id="a-reset">↺ Reset demo data</button></div>' +
      '</div>';

    $('#a-logout').onclick = async function () { await API.logout(); gate(); };
    $('#a-reset').onclick = async function () {
      if (!confirm('Reset all data back to the demo content? This cannot be undone.')) return;
      try { await API.admin.reset(); dashboard(); } catch (ex) { alert(ex.message); }
    };
  }

  /* delegated moderation clicks — attached once */
  root.addEventListener('click', async function (e) {
    var el;
    if ((el = e.target.closest('[data-deluser]'))) {
      if (!confirm('Delete this user and all their posts?')) return;
      try { await API.admin.delUser(Number(el.getAttribute('data-deluser'))); dashboard(); } catch (ex) { alert(ex.message); }
    } else if ((el = e.target.closest('[data-delpost]'))) {
      if (!confirm('Delete this post?')) return;
      try { await API.admin.delPost(Number(el.getAttribute('data-delpost'))); dashboard(); } catch (ex) { alert(ex.message); }
    }
  });

  async function start() {
    // verify we're logged in AND an admin
    var r;
    try { r = await API.me(); } catch (e) { r = { user: null }; }
    if (!r.user) { gate(); return; }
    if (r.user.role !== 'admin') { await API.logout(); gate('That account is not an admin.'); return; }
    dashboard();
  }

  (async function () {
    try { await AP.loadConfig(); } catch (e) {}
    start();
  })();
})();
