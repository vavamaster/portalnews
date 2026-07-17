# Deploy Guide

This guide covers deploying the News Portal to popular platforms.

## Prerequisites

1. **Database**: MySQL 8+ or MariaDB 10.4+
   - Serverless platforms (Vercel/Netlify) have read-only filesystem
2. **Node.js 20+**
3. **All environment variables** configured (see `.env.example`)

## Environment Variables (REQUIRED)

Set these in your deploy platform's dashboard:

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | YES | `mysql://user:pass@host:3306/pnews` | MySQL/MariaDB connection string |
| `APP_SECURITY_SECRET` | YES | `long-random-secret` | Base key for internal hashing and rate limits |
| `AD_TRACKING_SECRET` | YES | `long-random-secret` | Signs public advertising metrics |
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
6. Database: use an external MySQL/MariaDB service

**Notes:**
- The `postinstall` script runs `prisma generate` automatically
- The `sync-schema.js` script validates that `DATABASE_URL` points to MySQL/MariaDB
- After first deploy, run `npx prisma db push` to create tables

### Self-host (VPS / Docker)

1. Clone repo to server
2. Set env vars:
   ```bash
   export DATABASE_URL="mysql://user:pass@host:3306/pnews"
   export NEXT_PUBLIC_BASE_URL="https://your-domain.com"
   export CRON_SECRET="your-secret"
   export DEPLOY_TARGET=selfhost
   ```
3. Build: `npm run build`
4. Start: `npm start`
5. Set up reverse proxy (nginx/Caddy) → `localhost:3000`
6. Configure cron: `0 * * * * curl -H "Authorization: Bearer YOUR_SECRET" https://your-domain.com/api/cron/enterprise-check`

### Netlify

1. Push code to GitHub
2. Connect repo in Netlify
3. Build command: `npm run build`
4. Publish directory: `.next` (auto-detected by Netlify Next.js plugin)
5. Set environment variables
6. Database: use external MySQL/MariaDB

### Railway

1. Connect repo
2. Set env vars
3. Railway detects Next.js automatically
4. Add a MySQL service and configure `DATABASE_URL`

## Database Setup

### Migrate an existing SQLite database to MySQL

Keep a backup of `db/custom.db`, configure the MySQL URL, create the schema and run the verified migration:

```bash
npm run db:push
npm run db:mysql:migrate
```

The migration checks every source table and compares the final row counts.

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
7. ✅ Cron test: `curl -H "Authorization: Bearer YOUR_SECRET" https://your-domain.com/api/cron/enterprise-check` returns `{"ok":true,...}`

## Configure Cron (REQUIRED for Enterprise)

Add to your server's crontab (VPS) or use a cron service (Vercel/Netlify):

```bash
# Every hour — checks Enterprise billing cycles
0 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/enterprise-check" > /dev/null

# Daily at midnight — renews subscriptions
0 0 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/renew-subscriptions" > /dev/null

# Daily at 03:15 — removes expired sessions, tokens and old analytics details
15 3 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/maintenance" > /dev/null
```

## Common Deploy Issues

### "Prisma Client not found"
- Cause: `postinstall` script didn't run
- Fix: Make sure `postinstall` is in `package.json` (it is). Some platforms skip it — run `npm run postinstall` manually.

### "Database connection refused"
- Cause: `DATABASE_URL` wrong or DB not accessible
- Fix: Verify host, credentials, database name and TCP access to port 3306

### "Cannot find module '.prisma/client'"
- Cause: Prisma client wasn't generated
- Fix: `npx prisma generate` (or set `postinstall` script)

### Build fails with "output: standalone"
- Cause: `output: "standalone"` enabled but platform doesn't support it
- Fix: Don't set `DEPLOY_TARGET=selfhost` (leave unset for Vercel/Netlify)

### "DATABASE_URL deve apontar para MySQL/MariaDB"
- Cause: the project no longer accepts SQLite/PostgreSQL as its runtime provider
- Fix: set a valid `mysql://...` URL before install, build and start

### Large bundle size
- Cause: `output: "standalone"` includes all node_modules (295MB)
- Fix: Don't use standalone for Vercel/Netlify (build is 24MB without it)

## Platform-Specific Notes

### Vercel
- ✅ Native Next.js support
- ✅ Automatic Prisma detection
- ⚠️ Set `NEXT_PUBLIC_BASE_URL` to your Vercel domain
- ⚠️ Use external MySQL/MariaDB

### Netlify
- ✅ Next.js plugin handles everything
- ⚠️ Functions timeout at 10s on free plan (increase for Enterprise cron)
- ⚠️ Use external MySQL/MariaDB

### Railway
- ✅ Supports an attached MySQL service
- ✅ Automatic env var injection
- ⚠️ Free tier sleeps after inactivity

### Self-host (VPS)
- ✅ Full control
- ✅ Standalone build (smallest footprint)
- ⚠️ Need to set up reverse proxy (nginx/Caddy)
- ⚠️ Need to set up SSL (Let's Encrypt)
- ⚠️ Need to set up PM2/systemd for process management
