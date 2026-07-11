import { db } from '../src/lib/db'

async function main() {
  const rows = await db.seoSetting.findMany({
    where: { key: { startsWith: 'license' } },
  })
  console.log('=== License settings ===')
  for (const r of rows) {
    console.log(`${r.key} = ${r.value?.substring(0, 200)}${r.value && r.value.length > 200 ? '...' : ''}`)
  }
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
