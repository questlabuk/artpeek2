# Deploying Art Peek (no coding required)

Art Peek is a real web server with a database and saved image files, so it needs
a host that runs Node apps and keeps files permanently. **Netlify and Vercel
won't work** for this — they only run "serverless" code with no permanent storage,
so accounts and uploads would keep disappearing.

The easiest host that *does* work is **Render** (render.com). Here's the whole
process, all done by clicking in a web browser.

---

## Step 1 — Put the code on GitHub (browser only, no command line)

Render deploys from a code repository.

1. Make a free account at **github.com**.
2. Click the **+** (top right) → **New repository**. Name it `art-peek`, keep it
   **Public**, click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Unzip the Art Peek download on your computer, then drag **the contents of the
   `artpeek-server` folder** (server.js, package.json, the `public` folder, etc.)
   into the browser. Click **Commit changes**.

> Tip: drag the files/folders that are *inside* `artpeek-server`, so that
> `package.json` ends up at the top level of the repo (not inside a subfolder).

---

## Step 2 — Create the service on Render

1. Make a free account at **render.com** and connect your GitHub when asked.
2. Click **New +** → **Blueprint**.
3. Pick your `art-peek` repository. Render finds the included `render.yaml` and
   shows a service called **art-peek** with a 1 GB disk already configured.
4. Click **Apply**. Render installs everything and builds the app (~2–3 minutes).

When it finishes you'll get a public address like
`https://art-peek.onrender.com`. That's your live site! 🎉

The blueprint uses the **Starter** plan (~$7/month) plus a small disk, which is
what keeps your data forever. Render will ask for a payment method to enable the
disk.

### Want to try it free first?
On the Blueprint screen, or in the service's **Settings**, switch the plan to
**Free** and remove the disk. The site still runs, but **all accounts and uploads
reset whenever the app goes to sleep (after 15 min idle) or you redeploy** — fine
for a quick demo, not for real use.

---

## Step 3 — Lock it down before sharing with kids

1. Open your live site, log in as **admin / admin**.
2. (Recommended) The admin password is still the demo default — treat the
   `/admin` link as private until you change it. To change it properly you'd edit
   the seed in `db.js`; ask a developer friend, or just keep the admin URL to
   yourself.
3. `NODE_ENV=production` and a generated `JWT_SECRET` are already set by the
   blueprint, so logins are secure (HTTPS-only cookies) and stay valid across
   restarts.

---

## Updating the site later

Change a file in your GitHub repo (you can edit files right in the GitHub website
with the pencil icon) and Render automatically rebuilds and redeploys within a
couple of minutes. Your data on the disk is kept across updates.

---

## A note on cost & alternatives

- **Render Starter + disk** ≈ **$7/month** — recommended, data persists.
- **Railway** (railway.app) is another beginner-friendly option with usage-based
  pricing (roughly $5/month for something this small) and works the same way:
  connect the GitHub repo, add a volume, set `DATA_DIR` / `UPLOAD_DIR` to the
  volume path.
- A truly free, permanent option doesn't really exist for an app that stores
  files and accounts — free tiers reset their storage.
