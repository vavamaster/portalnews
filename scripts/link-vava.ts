import { db } from '../src/lib/db'

async function main() {
  // Link vavamaster as Enterprise
  const userId = 'cmqizl3fs0005jpte9nlr9elw'
  const link = await db.enterpriseUserLink.upsert({
    where: { userId },
    update: { isActive: true, companyName: 'VS Agencia' },
    create: { userId, companyName: 'VS Agencia', isActive: true },
  })
  console.log('Link created:', JSON.stringify(link, null, 2))
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
