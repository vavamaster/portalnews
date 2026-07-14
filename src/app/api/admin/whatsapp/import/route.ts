import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'

/**
 * POST /api/admin/whatsapp/import — bulk import subscribers
 * Body: { numbers: string[], listId?, source?: 'MANUAL'|'API' }
 *   - numbers: array of phone numbers (any format, will be normalized)
 *   - listId: optional list to add them to
 *   - source: defaults to 'MANUAL'
 *
 * Note: imported subscribers are marked as verified + active (admin import =
 *   pre-validated). This is the standard pattern for list migration.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAdminOrRespond(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))
    const { numbers, listId, source } = body
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json({ error: 'numbers deve ser um array não-vazio' }, { status: 400 })
    }
    if (numbers.length > 10000) {
      return NextResponse.json({ error: 'Máximo 10000 números por importação' }, { status: 400 })
    }

    // Validate listId if provided
    if (listId) {
      const list = await db.whatsAppSubscriberList.findUnique({ where: { id: listId } })
      if (!list) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 400 })
    }

    let imported = 0
    let duplicates = 0
    let invalid = 0

    // Process in chunks to avoid memory issues
    const chunkSize = 100
    for (let i = 0; i < numbers.length; i += chunkSize) {
      const chunk = numbers.slice(i, i + chunkSize)
      for (const rawPhone of chunk) {
        if (typeof rawPhone !== 'string') { invalid++; continue }
        const normalized = rawPhone.replace(/\D/g, '')
        if (normalized.length < 10 || normalized.length > 15) { invalid++; continue }

        try {
          const subscriber = await db.whatsAppSubscriber.upsert({
            where: { phoneNumber: normalized },
            create: {
              phoneNumber: normalized,
              isVerified: true,
              verifiedAt: new Date(),
              optInSource: source || 'IMPORT',
              isActive: true,
            },
            update: {
              isActive: true,
            },
          })
          // Add to default list
          const defaultList = await db.whatsAppSubscriberList.findFirst({ where: { isDefault: true } })
          if (defaultList) {
            await db.whatsAppSubscriberListEntry.upsert({
              where: { subscriberId_listId: { subscriberId: subscriber.id, listId: defaultList.id } },
              create: { subscriberId: subscriber.id, listId: defaultList.id },
              update: {},
            }).catch(() => {})
          }
          // Add to specified list
          if (listId) {
            await db.whatsAppSubscriberListEntry.upsert({
              where: { subscriberId_listId: { subscriberId: subscriber.id, listId } },
              create: { subscriberId: subscriber.id, listId },
              update: {},
            }).catch(() => {})
          }
          imported++
        } catch (e: any) {
          if (e?.code === 'P2002') duplicates++
          else invalid++
        }
      }
    }

    // Record import batch
    const batch = await db.whatsAppImportBatch.create({
      data: {
        fileName: null,
        source: source || 'MANUAL',
        totalRows: numbers.length,
        imported,
        duplicates,
        invalid,
        listId: listId || null,
        createdBy: user.id,
      },
    })

    return NextResponse.json({
      ok: true,
      batch,
      summary: { total: numbers.length, imported, duplicates, invalid },
    })
  } catch (e: any) {
    return handleApiError(e, 'whatsapp import')
  }
}
