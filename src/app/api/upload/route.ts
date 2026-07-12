import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import fs from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'

// POST /api/upload — handles file uploads (logo, favicon, og_image, ad images, etc.)
// Saves to /public/uploads/ and returns the public URL
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
      'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif'
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo não suportado: ${file.type}. Use JPG, PNG, WebP, SVG, GIF, ICO ou AVIF.` },
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
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
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
      { error: `Erro ao fazer upload: ${e.message}` },
      { status: 500 }
    )
  }
}
