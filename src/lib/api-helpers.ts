import { NextRequest, NextResponse } from 'next/server'

/**
 * Safely parse JSON body from a Next.js API request.
 * Returns { ok: true, data } on success, or { ok: false, response } on failure (400 Bad Request).
 *
 * Usage:
 *   const body = await safeReqJson(req)
 *   if (!body.ok) return body.response
 *   // body.data is the parsed JSON
 */
export async function safeReqJson<T = any>(req: NextRequest): Promise<
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }
> {
  try {
    const text = await req.text()
    if (!text) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Corpo da requisição vazio' }, { status: 400 }),
      }
    }
    const data = JSON.parse(text) as T
    return { ok: true, data }
  } catch (e: any) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'JSON inválido', detail: e?.message || 'parse error' },
        { status: 400 }
      ),
    }
  }
}
