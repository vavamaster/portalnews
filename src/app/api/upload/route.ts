import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { requireUserOrRespond } from '@/lib/api-helpers'
import fs from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'

// POST /api/upload — handles file uploads (logo, favicon, og_image, ad images, etc.)
// Saves to /public/uploads/ and returns the public URL.
// Accepts: JPG, PNG, WebP, SVG (admin only), GIF, ICO, AVIF. Max 5MB.
export async function POST(req: NextRequest) {
  const { user, response } = await requireUserOrRespond(req)
  if (response) return response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validate file type — SVG requires admin (XSS risk)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif',
    ]
    const svgAllowedForAdmin = user && ['MASTER', 'ADMIN'].includes(user.role)
    if (svgAllowedForAdmin) allowedTypes.push('image/svg+xml')

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo não suportado: ${file.type}. Use JPG, PNG, WebP, GIF, ICO ou AVIF.` },
        { status: 400 }
      )
    }

    // Validate extension matches MIME type (prevent mismatched extension)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const extToMime: Record<string, string> = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif',
      'ico': 'image/x-icon', 'avif': 'image/avif',
      'svg': 'image/svg+xml',
    }
    if (extToMime[ext] !== file.type) {
      return NextResponse.json(
        { error: 'Extensão do arquivo não corresponde ao tipo informado.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5MB.' }, { status: 400 })
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const filename = `${timestamp}-${randomStr}.${ext}`
    const filepath = path.join(uploadDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fs.writeFile(filepath, buffer)

    // Return public URL
    const url = `/uploads/${filename}`

    return NextResponse.json({ url, filename })
  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json(
      { error: 'Erro interno ao fazer upload' },
      { status: 500 }
    )
  }
}
