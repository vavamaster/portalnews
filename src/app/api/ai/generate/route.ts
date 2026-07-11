import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { generateArticle, AI_TEMPLATES } from '@/lib/ai-generator'

export const maxDuration = 120 // 2 minutes - needed for image search

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const body = await req.json()
    const { prompt, categoryName, templateId } = body

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json({ error: 'Prompt muito curto. Descreva o que quer noticiar.' }, { status: 400 })
    }

    // If templateId provided, resolve template prompt
    let finalPrompt = prompt
    if (templateId) {
      const template = AI_TEMPLATES.find(t => t.id === templateId)
      if (template) {
        // Replace placeholders with prompt values
        finalPrompt = template.prompt.replace(/\{[^}]+\}/g, (match) => {
          const key = match.slice(1, -1)
          // Try to find value in body
          if (body[key]) return body[key]
          // Return the placeholder as-is if not provided
          return match
        })
      }
    }

    const article = await generateArticle(finalPrompt, categoryName)

    return NextResponse.json({
      success: true,
      article,
      message: 'Matéria gerada com sucesso! Revise antes de publicar.',
    })
  } catch (e: any) {
    console.error('AI generation error:', e)
    return NextResponse.json({
      error: e.message || 'Erro ao gerar matéria. Tente novamente.',
    }, { status: 500 })
  }
}
