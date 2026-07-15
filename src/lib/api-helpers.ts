import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'

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

/**
 * Require an authenticated user. Returns the user or a 401 response.
 *
 * Usage:
 *   const { user, response } = await requireUserOrRespond(req)
 *   if (response) return response
 *   // user is non-null
 */
export async function requireUserOrRespond(req: NextRequest): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  response: null
} | {
  user: null
  response: NextResponse
}> {
  const user = await getCurrentUser(req)
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    }
  }
  return { user: user as NonNullable<typeof user>, response: null }
}

/**
 * Require an admin (MASTER or ADMIN) user. Returns the user or a 401/403 response.
 */
export async function requireAdminOrRespond(req: NextRequest): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  response: null
} | {
  user: null
  response: NextResponse
}> {
  const { user, response } = await requireUserOrRespond(req)
  if (response) return { user: null, response }
  if (!['MASTER', 'ADMIN'].includes(user!.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Permissão negada' }, { status: 403 }),
    }
  }
  return { user: user as any, response: null }
}

/** Require the platform owner role for credentials and destructive system configuration. */
export async function requireMasterOrRespond(req: NextRequest): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  response: null
} | {
  user: null
  response: NextResponse
}> {
  const { user, response } = await requireUserOrRespond(req)
  if (response) return { user: null, response }
  if (user!.role !== 'MASTER') {
    return {
      user: null,
      response: NextResponse.json({ error: 'Apenas MASTER pode acessar esta configuração' }, { status: 403 }),
    }
  }
  return { user: user as NonNullable<typeof user>, response: null }
}

/**
 * Require an editor-or-above user (EDITOR, ADMIN, MASTER).
 */
export async function requireEditorOrRespond(req: NextRequest): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  response: null
} | {
  user: null
  response: NextResponse
}> {
  const { user, response } = await requireUserOrRespond(req)
  if (response) return { user: null, response }
  if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user!.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Permissão negada' }, { status: 403 }),
    }
  }
  return { user: user as any, response: null }
}

/**
 * Centralized API error handler. Logs the full error server-side, returns a generic
 * 500 response to the client without leaking internal details (e.message, stack traces).
 *
 * Usage:
 *   try {
 *     // ... route logic
 *   } catch (e: any) {
 *     return handleApiError(e, 'classificados create')
 *   }
 */
export function handleApiError(e: any, context?: string): NextResponse {
  const ctx = context ? `[${context}]` : '[api]'
  if (e?.code === 'P2002') {
    // Prisma unique constraint violation
    const target = e?.meta?.target ? `: ${Array.isArray(e.meta.target) ? e.meta.target.join(', ') : e.meta.target}` : ''
    console.error(`${ctx} Prisma unique constraint violation${target}`)
    return NextResponse.json(
      { error: `Violação de unicidade: campo(s) duplicado(s)${target}` },
      { status: 409 }
    )
  }
  if (e?.code === 'P2025') {
    // Prisma record not found
    console.error(`${ctx} Prisma record not found`)
    return NextResponse.json(
      { error: 'Registro não encontrado' },
      { status: 404 }
    )
  }
  if (e?.code === 'P2003') {
    // Prisma foreign key constraint
    console.error(`${ctx} Prisma foreign key constraint failed`)
    return NextResponse.json(
      { error: 'Referência inválida (registro relacionado não existe)' },
      { status: 400 }
    )
  }
  console.error(`${ctx} Unhandled error:`, e?.message || e)
  return NextResponse.json(
    { error: 'Erro interno do servidor' },
    { status: 500 }
  )
}
