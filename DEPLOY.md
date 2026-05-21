# Deploying CourierOS to Vercel + GitHub

Step-by-step deploy walk-through. Total time ≈ 15 minutes if no env-var surprises.

---

## 1 · Create the GitHub repo (1 min)

1. Go to [github.com/new](https://github.com/new)
2. Repo name: `courier-os` (or whatever you like)
3. **Public** (you chose this)
4. Do NOT initialise with README / .gitignore / license — we already have those
5. Click **Create repository**
6. Copy the repo URL (looks like `https://github.com/YOUR-USERNAME/courier-os.git`)

---

## 2 · Push the code (1 min)

From `/Users/kristilomidze/projects/test_app` (or this worktree), tell me the repo URL and I'll run:

```bash
git remote add origin https://github.com/YOUR-USERNAME/courier-os.git
git add -A
git commit -m "Deploy v1"
git push -u origin main
```

(If pushing the worktree branch instead, replace `main` with `claude/sharp-chaum-a53176`.)

---

## 3 · Connect to Vercel (3 min)

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub OAuth works fine)
2. Click **Add New… → Project**
3. **Import** the GitHub repo you just created
4. Framework Preset should auto-detect as **Next.js** — leave as-is
5. Root Directory: leave blank (root of repo)
6. **Don't click Deploy yet** — first add env vars (next step)

---

## 4 · Add environment variables (5 min)

In the Vercel import screen, expand **Environment Variables** and paste these one at a time:

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.pmzlqsxlrdshoaxzndyh:Qwerty1%24Giorgi1@aws-1-eu-central-1.pooler.supabase.com:6543/postgres` | Pooler URL (port 6543). |
| `DIRECT_URL` | `postgresql://postgres.pmzlqsxlrdshoaxzndyh:Qwerty1%24Giorgi1@aws-1-eu-central-1.pooler.supabase.com:5432/postgres` | Direct port (5432). For schema introspection. |
| `AUTH_SECRET` | **generate a new one** — run `openssl rand -base64 32` in your terminal | Different from your dev secret. |
| `NEXTAUTH_URL` | `https://YOUR-VERCEL-URL.vercel.app` | Set AFTER first deploy. You'll get the URL from Vercel. Then redeploy. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pmzlqsxlrdshoaxzndyh.supabase.co` | Same as `.env.local`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_eMPYAKdSeN4wusvgVOjhSA_8Vp0am9f` | Same as `.env.local`. |

**Optional (for Google login on prod):**

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | From [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials. |
| `GOOGLE_CLIENT_SECRET` | Same place. **Rotate before going public** if you've shared this secret anywhere. |

---

## 5 · Deploy (auto, 2-3 min)

Click **Deploy**. Vercel runs:
1. `npm install` (auto-runs `prisma generate` via our `postinstall` script)
2. `npm run build` (runs `prisma generate && next build`)
3. Boots the production server

Watch the build log. If it fails, the error is usually a missing env var or DB URL typo.

---

## 6 · Post-deploy fixes (5 min)

### A. Update `NEXTAUTH_URL` env var

After first deploy, Vercel assigns a URL like `courier-os-abc123.vercel.app`. Go to **Settings → Environment Variables**, set `NEXTAUTH_URL` to that URL with `https://`, then **redeploy**.

### B. Add Vercel URL to Supabase Auth redirect URLs

For Google OAuth to work in production:

1. [Supabase dashboard](https://supabase.com/dashboard) → your project → **Authentication → URL Configuration**
2. Add `https://YOUR-VERCEL-URL.vercel.app/auth/callback` to **Redirect URLs**
3. Save

### C. Test

- Visit `https://YOUR-VERCEL-URL.vercel.app`
- Log in with `kagon` / `Kagon2026!` — should work
- Check `/admin`, `/courier`, `/company` views
- Try Google OAuth if configured

---

## 7 · Rotate secrets after going public

You shared these in dev — **rotate them before opening the URL to anyone**:

- [ ] **Supabase DB password** — Supabase dashboard → Project Settings → Database → Reset password. Update both Vercel env vars.
- [ ] **AUTH_SECRET** — already generated a new one for prod, but make sure it's different from dev.
- [ ] **Google Client Secret** — if you ever shared the dev secret, rotate it in Google Cloud Console.

---

## What's in this repo that's ready for Vercel

- ✅ `package.json` — `prisma generate` runs in `postinstall` and `build`
- ✅ `vercel.json` — region set to `fra1` (Frankfurt, closest to your Supabase EU-Central)
- ✅ `.gitignore` — excludes `.env*`, `.next/`, `.vercel`, `.claude/`
- ✅ `proxy.ts` — Next.js 16 middleware (NB: not `middleware.ts`, Next 16 renamed it)
- ✅ `prisma/schema.prisma` — `provider = "postgresql"`; URL injected via `prisma.config.ts` at runtime
- ✅ Local production build verified: `npm run build` passes
