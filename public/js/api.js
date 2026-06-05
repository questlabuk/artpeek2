/* ============================================================
   Art Peek — frontend API client + shared helpers
   Talks to the Express/SQLite backend. Auth is via httpOnly
   cookie (set by the server), so there are no tokens to manage.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- fetch wrapper ---------- */
  async function req(method, url, body, isForm) {
    var init = { method: method, credentials: 'same-origin' };
    if (body != null) {
      if (isForm) { init.body = body; }
      else { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(body); }
    }
    var res = await fetch(url, init);
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || ('Something went wrong (' + res.status + ').'));
    return data;
  }

  var API = {
    config:      function () { return req('GET', '/api/config'); },
    me:          function () { return req('GET', '/api/auth/me'); },
    signup:      function (fd) { return req('POST', '/api/auth/signup', fd, true); },
    login:       function (u, p) { return req('POST', '/api/auth/login', { username: u, password: p }); },
    logout:      function () { return req('POST', '/api/auth/logout'); },
    feed:        function (mode) { return req('GET', '/api/feed?mode=' + encodeURIComponent(mode || 'all')); },
    groups:      function () { return req('GET', '/api/groups'); },
    groupPosts:  function (id) { return req('GET', '/api/groups/' + encodeURIComponent(id) + '/posts'); },
    user:        function (id) { return req('GET', '/api/users/' + encodeURIComponent(id)); },
    updateMe:    function (fd) { return req('PATCH', '/api/users/me', fd, true); },
    createPost:  function (fd) { return req('POST', '/api/posts', fd, true); },
    like:        function (id) { return req('POST', '/api/posts/' + id + '/like'); },
    share:       function (id) { return req('POST', '/api/posts/' + id + '/share'); },
    follow:      function (id) { return req('POST', '/api/users/' + id + '/follow'); },
    admin: {
      stats:   function () { return req('GET', '/api/admin/stats'); },
      users:   function () { return req('GET', '/api/admin/users'); },
      posts:   function () { return req('GET', '/api/admin/posts'); },
      delUser: function (id) { return req('DELETE', '/api/admin/users/' + id); },
      delPost: function (id) { return req('DELETE', '/api/admin/posts/' + id); },
      reset:   function () { return req('POST', '/api/admin/reset'); }
    }
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 7) return d + 'd ago';
    var w = Math.floor(d / 7); if (w < 5) return w + 'w ago';
    return new Date(ts).toLocaleDateString();
  }

  var ICONS = {
    home:   '<path d="M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>',
    grid:   '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
    user:   '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
    heart:  '<path d="M12 21s-7.5-4.6-10-9.3C.6 8.5 2.2 5 5.5 5c2 0 3.3 1.2 4 2.3C10.2 6.2 11.5 5 13.5 5 16.8 5 18.4 8.5 17 11.7 14.5 16.4 7 21 7 21"/>',
    share:  '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    palette:'<path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.3 1.2-2.2-.8-1 0-2.3 1.3-2.3H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    check:  '<path d="M20 6L9 17l-5-5"/>',
    x:      '<path d="M18 6L6 18M6 6l12 12"/>',
    trash:  '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  function toast(msg) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  /* ---------- theme (cosmetic only -> kept client-side) ---------- */
  var Theme = {
    apply: function () { document.body.setAttribute('data-theme', String(Theme.current())); },
    current: function () { return Number(localStorage.getItem('ap_theme') || 1); },
    cycle: function () {
      var t = (Theme.current() % 3) + 1;
      localStorage.setItem('ap_theme', String(t));
      document.body.setAttribute('data-theme', String(t));
      return t;
    }
  };

  /* ---------- config + badges ---------- */
  var cfg = { groups: [], bioQuestions: [], badges: [] };
  async function loadConfig() { var c = await API.config(); cfg.groups = c.groups; cfg.bioQuestions = c.bioQuestions; cfg.badges = c.badges; return cfg; }
  function groupById(id) { return cfg.groups.filter(function (g) { return g.id === id; })[0]; }
  function badgesFor(count) {
    return cfg.badges.map(function (b) { return { emoji: b.emoji, name: b.name, min: b.min, unlocked: count >= b.min }; });
  }

  /* ---------- client-side image resize before upload ---------- */
  function resizeToBlob(file, max) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.82);
        };
        img.onerror = reject; img.src = e.target.result;
      };
      r.onerror = reject; r.readAsDataURL(file);
    });
  }

  global.AP = {
    API: API, Theme: Theme, cfg: cfg,
    loadConfig: loadConfig, groupById: groupById, badgesFor: badgesFor,
    esc: esc, icon: icon, toast: toast, timeAgo: timeAgo, resizeToBlob: resizeToBlob
  };
})(window);
