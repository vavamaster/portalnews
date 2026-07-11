// Clean up stale landing pages — delete all existing ones so companies start fresh
import { db } from '../src/lib/db'

async function main() {
  const deleted = await db.enterpriseLandingPage.deleteMany({})
  console.log(`Deleted ${deleted.count} stale landing pages`)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
