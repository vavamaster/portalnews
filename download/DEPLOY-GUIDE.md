# Deploy Guide

This guide covers deploying the News Portal to popular platforms.

## Prerequisites

1. **Database**: A real database (NOT SQLite) — PostgreSQL or MySQL
   - SQLite works only for local development
   - Serverless platforms (Vercel/Netlify) have read-only filesystem
2. **Node.js 18+** (or Bun 1.0+)
3. **All environment variables** configured (see `.env.example`)

## Environment Variables (REQUIRED)

Set these in your deploy platform's dashboard:

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | YES | `postgresql://user:pass@host:5432/db` | Database connection string |
| `NEXT_PUBLIC_BASE_URL` | YES | `https://your-domain.com` | Public site URL (for sitemap/SEO) |
| `CRON_SECRET` | YES | `any-random-string` | Auth token for cron endpoints |

Optional:
| Variable | Example | Description |
|----------|---------|-------------|
| `DEPLOY_TARGET` | `selfhost` | Set to enable Next.js standalone output (VPS/Docker only) |

## Deploy Targets

### Vercel (recommended for Next.js)

1. Push code to GitHub/GitLab
2. Import the repo in Vercel
3. Set environment variables (above)
4. Build command: `npm run build` (auto-detected)
5. Output: Vercel handles everything (no `output: "standalone"` needed)
6. Database: use Vercel Postgres or external (Neon, Supabase, Railway)

**Notes:**
- The `postinstall` script runs `prisma generate` automatically
- The `sync-schema.js` script switches Prisma to PostgreSQL based on `DATABASE_URL`
- After first deploy, run `npx prisma db push` to create tables

### Self-host (VPS / Docker)

1. Clone repo to server
2. Set env vars:
   ```bash
   export DATABASE_URL="postgresql://..."
   export NEXT_PUBLIC_BASE_URL="https://your-domain.com"
   export CRON_SECRET="your-secret"
   export DEPLOY_TARGET=selfhost
   ```
3. Build: `npm run build:selfhost`
4. Start: `npm start` (uses `bun .next/standalone/server.js`)
5. Set up reverse proxy (nginx/Caddy) → `localhost:3000`
6. Configure cron: `0 * * * * curl https://your-domain.com/api/cron/enterprise-check?key=YOUR_SECRET`

### Netlify

1. Push code to GitHub
2. Connect repo in Netlify
3. Build command: `npm run build`
4. Publish directory: `.next` (auto-detected by Netlify Next.js plugin)
5. Set environment variables
6. Database: use external PostgreSQL (Neon, Supabase)

### Railway

1. Connect repo
2. Set env vars
3. Railway detects Next.js automatically
4. Add PostgreSQL plugin (Railway provides `DATABASE_URL` automatically)

## Database Setup

### Switch from SQLite to PostgreSQL

The `DATABASE_URL` env var automatically switches the Prisma provider:

- `file:./db/custom.db` → SQLite (dev only)
- `postgresql://...` → PostgreSQL (production)
- `mysql://...` → MySQL (production)

The `scripts/sync-schema.js` script (run automatically by `postinstall` and `build`) updates `prisma/schema.prisma` with the correct provider.

### Create Tables on Production

After first deploy, run:

```bash
# Set DATABASE_URL first
npx prisma db push
```

This creates all tables in your production database.

### Seed Data (optional)

```bash
npx tsx scripts/setup-defaults.ts
```

This populates `SeoSetting` with sensible defaults (site name, points config, etc).

## Post-Deploy Checklist

1. ✅ Site loads at `https://your-domain.com`
2. ✅ `/api/seo` returns settings (DATABASE_URL working)
3. ✅ `/sitemap.xml` shows your domain (NEXT_PUBLIC_BASE_URL working)
4. ✅ `/robots.txt` accessible
5. ✅ Login works (`/api/auth/login`)
6. ✅ Admin accessible at `/?view=admin`
7. ✅ Cron test: `curl https://your-domain.com/api/cron/enterprise-check?key=YOUR_SECRET` returns `{"ok":true,...}`

## Configure Cron (REQUIRED for Enterprise)

Add to your server's crontab (VPS) or use a cron service (Vercel/Netlify):

```bash
# Every hour — checks Enterprise billing cycles
0 * * * * curl -s "https://your-domain.com/api/cron/enterprise-check?key=YOUR_CRON_SECRET" > /dev/null

# Daily at midnight — renews subscriptions
0 0 * * * curl -s "https://your-domain.com/api/cron/renew-subscriptions?key=YOUR_CRON_SECRET" > /dev/null
```

## Common Deploy Issues

### "Prisma Client not found"
- Cause: `postinstall` script didn't run
- Fix: Make sure `postinstall` is in `package.json` (it is). Some platforms skip it — run `npm run postinstall` manually.

### "Database connection refused"
- Cause: `DATABASE_URL` wrong or DB not accessible
- Fix: Verify the URL works with `psql $DATABASE_URL` or use a connection tester

### "Cannot find module '.prisma/client'"
- Cause: Prisma client wasn't generated
- Fix: `npx prisma generate` (or set `postinstall` script)

### Build fails with "output: standalone"
- Cause: `output: "standalone"` enabled but platform doesn't support it
- Fix: Don't set `DEPLOY_TARGET=selfhost` (leave unset for Vercel/Netlify)

### "SQLite: disk I/O error" on Vercel
- Cause: SQLite doesn't work on serverless (read-only filesystem)
- Fix: Switch to PostgreSQL — set `DATABASE_URL=postgresql://...`

### Large bundle size
- Cause: `output: "standalone"` includes all node_modules (295MB)
- Fix: Don't use standalone for Vercel/Netlify (build is 24MB without it)

## Platform-Specific Notes

### Vercel
- ✅ Native Next.js support
- ✅ Automatic Prisma detection
- ⚠️ Set `NEXT_PUBLIC_BASE_URL` to your Vercel domain
- ⚠️ Use external PostgreSQL (Neon, Supabase, Vercel Postgres)

### Netlify
- ✅ Next.js plugin handles everything
- ⚠️ Functions timeout at 10s on free plan (increase for Enterprise cron)
- ⚠️ Use external PostgreSQL

### Railway
- ✅ Built-in PostgreSQL plugin
- ✅ Automatic env var injection
- ⚠️ Free tier sleeps after inactivity

### Self-host (VPS)
- ✅ Full control
- ✅ Standalone build (smallest footprint)
- ⚠️ Need to set up reverse proxy (nginx/Caddy)
- ⚠️ Need to set up SSL (Let's Encrypt)
- ⚠️ Need to set up PM2/systemd for process management
