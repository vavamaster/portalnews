import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  const hashed = await hashPassword('admin123')
  await db.user.update({
    where: { email: 'vavamaster@vsagencia.net' },
    data: { password: hashed },
  })
  console.log('Password updated to admin123')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
