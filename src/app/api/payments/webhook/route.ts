import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Webhook endpoint for payment providers (Asaas, Mercado Pago, Stripe)
// In production, each provider would call this with their signature format
// We accept a unified payload and update the transaction status
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, event, transactionId, externalId, status } = body

    if (!provider || !event) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Find transaction
    let tx: { id: string; status: string; type: string; refId: string | null } | null = null
    if (transactionId) {
      tx = await db.paymentTransaction.findUnique({ where: { id: transactionId } })
    } else if (externalId) {
      tx = await db.paymentTransaction.findFirst({ where: { externalId } })
    }

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Update transaction status
    const newStatus = status || (event === 'PAYMENT_RECEIVED' || event === 'payment.success' ? 'PAID' : tx.status)
    await db.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: newStatus },
    })

    // If subscription payment confirmed, ensure subscription is active
    if (newStatus === 'PAID' && tx.type === 'SUBSCRIPTION' && tx.refId) {
      await db.subscription.update({
        where: { id: tx.refId },
        data: { status: 'ACTIVE' },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
