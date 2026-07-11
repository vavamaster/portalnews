import { db } from '../src/lib/db'

async function main() {
  const rows = await db.seoSetting.findMany()
  console.log('=== SEO Settings ===')
  for (const r of rows) {
    console.log(`${r.key} = ${JSON.stringify(r.value)}`)
  }
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
