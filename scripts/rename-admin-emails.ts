// Rename admin/editor emails to generic ones (no "altogarcas" branding anywhere)
import { db } from '../src/lib/db'

async function main() {
  console.log('=== Updating admin/editor emails to generic values ===')

  // Rename admin@altogarcas.com → admin@portal.com
  const admin = await db.user.findUnique({ where: { email: 'admin@altogarcas.com' } })
  if (admin) {
    // Check if target email already exists
    const existing = await db.user.findUnique({ where: { email: 'admin@portal.com' } })
    if (!existing) {
      await db.user.update({ where: { id: admin.id }, data: { email: 'admin@portal.com', name: 'Admin Master' } })
      console.log(`  ✓ Renamed admin: admin@altogarcas.com → admin@portal.com`)
    } else {
      // Just delete the old one
      await db.user.delete({ where: { id: admin.id } })
      console.log(`  ✓ Removed duplicate admin@altogarcas.com (kept admin@portal.com)`)
    }
  } else {
    console.log(`  • admin@altogarcas.com not found`)
  }

  // Rename editor@altogarcas.com → editor@portal.com
  const editor = await db.user.findUnique({ where: { email: 'editor@altogarcas.com' } })
  if (editor) {
    const existing = await db.user.findUnique({ where: { email: 'editor@portal.com' } })
    if (!existing) {
      await db.user.update({ where: { id: editor.id }, data: { email: 'editor@portal.com', name: 'Editor Demo' } })
      console.log(`  ✓ Renamed editor: editor@altogarcas.com → editor@portal.com`)
    } else {
      await db.user.delete({ where: { id: editor.id } })
      console.log(`  ✓ Removed duplicate editor@altogarcas.com (kept editor@portal.com)`)
    }
  } else {
    console.log(`  • editor@altogarcas.com not found`)
  }

  // Verify
  const users = await db.user.findMany({ select: { email: true, name: true, role: true } })
  console.log('\n=== Users after cleanup ===')
  for (const u of users) {
    console.log(`${u.role.padEnd(8)}  ${u.email.padEnd(40)}  ${u.name}`)
  }

  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
