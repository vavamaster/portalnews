import { db } from '../src/lib/db'

async function main() {
  const u = await db.user.findUnique({
    where: { email: 'vavamaster@vsagencia.net' },
    select: { id: true, name: true, email: true, role: true, password: true }
  })
  if (!u) {
    console.log('User not found')
  } else {
    console.log(`id: ${u.id}`)
    console.log(`name: ${u.name}`)
    console.log(`email: ${u.email}`)
    console.log(`role: ${u.role}`)
    console.log(`has password: ${Boolean(u.password)}`)
  }
  const link = await db.enterpriseUserLink.findUnique({ where: { userId: u?.id || 'x' } })
  console.log('Enterprise link:', link)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
