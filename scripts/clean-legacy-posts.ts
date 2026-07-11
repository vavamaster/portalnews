// Clean up legacy content in existing posts.
// Replaces the old brand name with the generic "Portal" / "Cidade" / blank, so the
// already-published articles don't leak the old brand.
import { db } from '../src/lib/db'

async function main() {
  console.log('=== Cleaning legacy references in posts ===')

  const posts = await db.post.findMany({
    where: {
      OR: [
        { title: { contains: 'Alta Garças' } },
        { title: { contains: 'alta garças' } },
        { subtitle: { contains: 'Alta Garças' } },
        { excerpt: { contains: 'Alta Garças' } },
        { content: { contains: 'Alta Garças' } },
        { tags: { contains: 'alta garças' } },
        { tags: { contains: 'Alta Garças' } },
        { customFields: { contains: 'Alta Garças' } },
      ],
    },
    select: { id: true, title: true, subtitle: true, excerpt: true, content: true, tags: true, customFields: true, seoTitle: true, seoDescription: true, seoKeywords: true },
  })

  console.log(`Found ${posts.length} posts with legacy references`)

  let updated = 0
  for (const p of posts) {
    const clean = (s: string | null | undefined) => {
      if (!s) return s
      return s
        .replace(/Redação Alta Garças/g, 'Redação Portal')
        .replace(/Alta Garças,?\s*MT/gi, 'Cidade, MT')
        .replace(/Alta Garças,?\s*Mato Grosso/gi, 'Cidade, Mato Grosso')
        .replace(/\bAlta Garças\b/g, 'a cidade')
        .replace(/\balta garças\b/g, 'a cidade')
        .replace(/alta-garcas/gi, 'cidade')
        .replace(/alta-garcenses/gi, 'moradores locais')
        .replace(/AltaGarcas/g, 'Portal')
        .replace(/altogarcas\.com/gi, 'portal.com')
        .replace(/@altogarcas/gi, '@portal')
    }

    const newTitle = clean(p.title) || p.title
    const newSubtitle = clean(p.subtitle)
    const newExcerpt = clean(p.excerpt)
    const newContent = clean(p.content)
    const newTags = clean(p.tags)
    const newCustomFields = clean(p.customFields)
    const newSeoTitle = clean(p.seoTitle)
    const newSeoDescription = clean(p.seoDescription)
    const newSeoKeywords = clean(p.seoKeywords)

    await db.post.update({
      where: { id: p.id },
      data: {
        title: newTitle,
        subtitle: newSubtitle || undefined,
        excerpt: newExcerpt || undefined,
        content: newContent || undefined,
        tags: newTags || undefined,
        customFields: newCustomFields || undefined,
        seoTitle: newSeoTitle || undefined,
        seoDescription: newSeoDescription || undefined,
        seoKeywords: newSeoKeywords || undefined,
      },
    })
    updated++
    console.log(`  ✓ Cleaned: ${p.title.substring(0, 60)}...`)
  }

  console.log(`\nDone. Updated ${updated} posts.`)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
