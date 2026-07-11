/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/sync-schema.js
// Switches Prisma provider between sqlite and postgresql based on DATABASE_URL.
// Run this before `prisma generate` / `prisma db push` on deploy platforms.
//
// Usage:
//   node scripts/sync-schema.js
//
// Behavior:
//   - DATABASE_URL starts with "file:"      → provider = "sqlite"
//   - DATABASE_URL starts with "postgres:"  → provider = "postgresql"
//   - DATABASE_URL starts with "mysql:"     → provider = "mysql"
//   - otherwise                              → keep current provider

const fs = require('fs')
const path = require('path')

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const dbUrl = process.env.DATABASE_URL || ''

let provider = 'sqlite' // default
if (dbUrl.startsWith('postgres:') || dbUrl.startsWith('postgresql:')) {
  provider = 'postgresql'
} else if (dbUrl.startsWith('mysql:')) {
  provider = 'mysql'
} else if (dbUrl.startsWith('file:')) {
  provider = 'sqlite'
}

console.log(`[sync-schema] DATABASE_URL prefix: "${dbUrl.split(':')[0] || '(empty)'}" → provider = "${provider}"`)

let schema = fs.readFileSync(schemaPath, 'utf8')

// Match the provider line INSIDE the datasource block (not the generator block).
// We look for `datasource db { ... provider = "..." ... }` and replace the provider value.
let updated = false
const newSchema = schema.replace(
  /(datasource db \{[^}]*?provider\s*=\s*")[^"]*(")/m,
  (match, before, after) => {
    updated = true
    return `${before}${provider}${after}`
  }
)

if (!updated) {
  console.error('[sync-schema] Could not find provider line in datasource block')
  // Don't fail — let prisma generate use whatever is there
  process.exit(0)
}

fs.writeFileSync(schemaPath, newSchema)
console.log(`[sync-schema] ✓ schema.prisma updated with provider = "${provider}"`)
