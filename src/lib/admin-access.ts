import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import { getCurrentUser } from './session'
import { safeJsonArray } from './utils'
import { EDITOR_PANEL_SECTIONS } from './admin-navigation'

export type EditorPanelSection = typeof EDITOR_PANEL_SECTIONS[number]

export async function getEffectiveEditorPanelAccess(userId: string): Promise<EditorPanelSection[]> {
  const profile = await db.editorProfile.findUnique({
    where: { userId },
    select: { panelAccess: true },
  })
  const configured = profile?.panelAccess == null
    ? [...EDITOR_PANEL_SECTIONS]
    : safeJsonArray<string>(profile.panelAccess, [])
  return EDITOR_PANEL_SECTIONS.filter(section => configured.includes(section))
}

export async function editorCanAccess(userId: string, section: EditorPanelSection) {
  const access = await getEffectiveEditorPanelAccess(userId)
  return access.includes(section)
}

export async function requirePanelSectionOrRespond(req: NextRequest, section: EditorPanelSection) {
  const user = await getCurrentUser(req)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }
  if (['MASTER', 'ADMIN'].includes(user.role)) return { user, response: null }
  if (user.role !== 'EDITOR' || !(await editorCanAccess(user.id, section))) {
    return { user: null, response: NextResponse.json({ error: 'Permissão negada' }, { status: 403 }) }
  }
  return { user, response: null }
}
