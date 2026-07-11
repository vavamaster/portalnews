import { db } from '../src/lib/db'

async function main() {
  const users = await db.user.findMany({ select: { email: true, name: true, role: true } })
  console.log('=== Users ===')
  for (const u of users) {
    console.log(`${u.role.padEnd(8)}  ${u.email.padEnd(40)}  ${u.name}`)
  }
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
