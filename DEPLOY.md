# Deploying Campus IT Help Desk (free)

| Piece | Host | Why |
|---|---|---|
| Database | **Neon** (free Postgres) | Free plan does not expire. Render's free Postgres is deleted 30 days after creation. |
| API (backend/) | **Render** free web service | Runs Node/Express from GitHub. Sleeps after 15 min idle; first request takes ~1 min to wake. |
| Website (frontend/) | **Vercel** Hobby (free) | Builds the Vite app and serves it worldwide. |

Total time: about 20–30 minutes. You need a GitHub account.

## 1. Put the code on GitHub

```bash
cd campus-it-helpdesk
git init
git add .
git commit -m "Campus IT Help Desk"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR-NAME/campus-it-helpdesk.git
git push -u origin main
```

`.env` files are git-ignored, so no secrets are uploaded.

## 2. Create the database on Neon

1. Sign up at https://neon.com (no credit card needed).
2. Create a project (any name, e.g. `campus-helpdesk`, region closest to you, e.g. US East).
3. On the project dashboard click **Connect** and copy the connection string. It looks like
   `postgresql://user:password@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Load the tables and demo data from your computer:

```bash
cd backend
npm install
DATABASE_URL="PASTE_NEON_URL_HERE" npm run seed
```

(Windows PowerShell: `$env:DATABASE_URL="PASTE_NEON_URL_HERE"; npm run seed`)

## 3. Deploy the API on Render

1. Sign up at https://render.com with GitHub.
2. Click **New → Blueprint**, pick your repo. Render reads `render.yaml`.
3. When asked, fill in:
   - `DATABASE_URL`: the Neon connection string
   - `CORS_ORIGIN`: leave as `https://placeholder.vercel.app` for now (you will fix it in step 5)
   - `JWT_SECRET` is generated for you.
4. Click **Apply**. When it is live, open `https://YOUR-API.onrender.com/api/health`. You should see `{"ok":true,...}`.

*No Blueprint?* Use **New → Web Service** instead: Root Directory `backend`, Build `npm install`, Start `npm start`, Instance type **Free**, and add the same environment variables plus `NODE_ENV=production`.

## 4. Deploy the website on Vercel

1. Sign up at https://vercel.com with GitHub.
2. **Add New → Project**, import the repo.
3. Set **Root Directory** to `frontend`. Vercel detects Vite (build `npm run build`, output `dist`).
4. Under **Environment Variables** add `VITE_API_URL` = `https://YOUR-API.onrender.com` (no trailing slash, no `/api`).
5. Click **Deploy**. You will get a URL like `https://campus-helpdesk.vercel.app`.

`frontend/vercel.json` makes page refreshes on routes like `/tickets/12` work.

## 5. Connect the two

Back in Render → your service → **Environment**, set `CORS_ORIGIN` to your Vercel URL
(e.g. `https://campus-helpdesk.vercel.app`) and save. Render redeploys automatically.

Open the Vercel URL and sign in with a demo account. Done.

## Before your presentation

- **Wake the API 2–3 minutes early.** Open `https://YOUR-API.onrender.com/api/health` and wait for `{"ok":true}`. The free service sleeps after 15 idle minutes.
- To reset the demo data: `DATABASE_URL="NEON_URL" npm run seed`.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach the server" on the site | API asleep (wait a minute) or `VITE_API_URL` wrong. After changing it, redeploy on Vercel. |
| Login works on localhost but not online | `CORS_ORIGIN` on Render must exactly match the Vercel URL (https, no trailing slash). |
| Render log: "Could not connect to the database" | `DATABASE_URL` is wrong or missing `?sslmode=require`. |
| Page refresh shows 404 | Make sure Root Directory is `frontend` so `vercel.json` is used. |

## Other options

- **Render for everything:** also possible (Render Static Site for the frontend, Render Postgres for the database), but the free database is deleted 30 days after you create it. If you go that way, create it after December 1 so it lasts past the December 7 presentation.
- **Supabase** also offers free Postgres if you prefer it to Neon. Paste its connection string as `DATABASE_URL`.
