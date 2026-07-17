/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/sync-schema.js
// Validates the MySQL/MariaDB database configuration before Prisma commands.

require('dotenv').config()

const dbUrl = process.env.DATABASE_URL || ''

if (!dbUrl.startsWith('mysql:')) {
  console.error('[database] DATABASE_URL deve apontar para MySQL/MariaDB (mysql://...).')
  process.exit(1)
}

console.log('[database] schema MySQL/MariaDB confirmado.')
