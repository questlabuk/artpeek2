# Art Peek — full-stack 🎨

A friendly, Tumblr-style art-sharing site for kids and teens, now with a **real
backend**: a Node/Express API, a SQLite database, hashed passwords, and proper
login sessions. Profiles, artwork, likes, follows and uploaded images all live on
the server — not in the browser.

---

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd artpeek-server
npm install      # installs Express, SQLite, bcrypt, etc.
npm start        # starts the server on http://localhost:3000
```

Then open **http://localhost:3000**.

On first run the database is created and filled with a few demo artists and
artworks automatically.

- **Demo artist:** username `pixelpanda`, password `demo`
- **Admin:** username `admin`, password `admin` → dashboard at **/admin**

(Or just hit **Sign up** and make your own profile.)

---

## What's real now

| Area            | How it works                                                                 |
|-----------------|------------------------------------------------------------------------------|
| **Auth**        | Passwords hashed with bcrypt. Login issues a signed JWT in an **httpOnly cookie** (not readable by JavaScript). |
| **Storage**     | A real **SQLite** database (`data/artpeek.sqlite`) holds users, posts, likes and follows. |
| **Images**      | Uploaded files are validated (type + size), stored on disk in `uploads/`, and served back by the server. Big images are shrunk in the browser before upload. |
| **Admin**       | The dashboard is gated by a real **admin role** checked on the server for every admin API call — not a client-side passcode. |
| **Theme**       | The background-switcher is purely cosmetic, so it stays a per-device preference in `localStorage`. |

---

## How it's built

```
artpeek-server/
├─ server.js        Express app + all API routes
├─ db.js            SQLite (via sql.js) — schema, queries, persistence, seed data
├─ auth.js          JWT signing, cookies, and auth/admin middleware
├─ config.js        Groups, bio questions and badge tiers (served to the client)
├─ artgen.js        Generates the demo SVG artwork & default avatars
├─ public/          The front-end (HTML/CSS/JS) the server hands to the browser
│  ├─ index.html, js/api.js, js/app.js
│  ├─ admin/        The admin dashboard
│  ├─ css/style.css
│  └─ assets/       Logos, doodles, backgrounds
├─ data/            Created on first run — the database lives here  (git-ignored)
└─ uploads/         Created on first run — uploaded images live here (git-ignored)
```

`sql.js` (SQLite compiled to WebAssembly) is used instead of a native SQLite
module so the project installs cleanly anywhere without a compiler. The database
is kept in memory and written to `data/artpeek.sqlite` after changes.

---

## API at a glance

```
GET    /api/config                 groups, bio questions, badge tiers
POST   /api/auth/signup            create account (optional avatar upload)
POST   /api/auth/login             log in
POST   /api/auth/logout            log out
GET    /api/auth/me                current user

GET    /api/feed?mode=all|following
GET    /api/groups
GET    /api/groups/:id/posts
GET    /api/users/:idOrUsername
PATCH  /api/users/me               update profile / avatar
POST   /api/posts                  upload artwork           (login required)
POST   /api/posts/:id/like         toggle like              (login required)
POST   /api/posts/:id/share        share                    (login required)
POST   /api/users/:id/follow       toggle follow            (login required)

GET    /api/admin/stats|users|posts            (admin only)
DELETE /api/admin/users/:id  |  /api/admin/posts/:id   (admin only)
POST   /api/admin/reset            restore demo data        (admin only)
```

---

## Before using this for real ⚠️

This is a solid foundation, but a couple of things to do before putting real
children's data on a public server:

1. **Change the admin password** (the seed creates `admin` / `admin`).
2. **Set environment variables** in production:
   ```bash
   NODE_ENV=production JWT_SECRET="a-long-random-string" npm start
   ```
   `NODE_ENV=production` makes the auth cookie `Secure` (HTTPS-only), and setting
   `JWT_SECRET` keeps logins valid across restarts. (If unset, a random secret is
   generated and saved to `data/.jwt_secret`.)
3. Consider rate-limiting the login/signup routes and adding image moderation —
   important for a platform aimed at young people.

---

Made with doodles 🖍️
