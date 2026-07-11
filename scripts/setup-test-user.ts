import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  // Create or update a test user without Enterprise access
  const email = 'testeuser@portal.com'
  const existing = await db.user.findUnique({ where: { email } })
  const hashed = await hashPassword('123456')

  if (existing) {
    await db.user.update({ where: { email }, data: { password: hashed } })
    console.log('Updated password for:', email)
  } else {
    await db.user.create({
      data: {
        email,
        name: 'Usuario Teste',
        password: hashed,
        role: 'READER',
        referralCode: 'TESTE123',
      },
    })
    console.log('Created user:', email)
  }

  // Make sure they DON'T have enterprise access
  await db.enterpriseUserLink.deleteMany({ where: { userId: (await db.user.findUnique({ where: { email } }))?.id } })
  console.log('Enterprise access removed (if any)')

  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
