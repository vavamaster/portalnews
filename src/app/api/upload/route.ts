import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { requireUserOrRespond } from '@/lib/api-helpers'
import fs from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { getUploadDirectories } from '@/lib/upload-storage'
import crypto from 'node:crypto'

function hasSupportedImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  if (mimeType === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  if (mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon') {
    return buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0
  }
  if (mimeType === 'image/avif') {
    const box = buffer.subarray(4, 32).toString('ascii')
    return buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /(avif|avis)/.test(box)
  }
  return false
}

// POST /api/upload — handles file uploads (logo, favicon, og_image, ad images, etc.)
// Persists uploads outside the standalone build and mirrors them to the active runtime.
// Accepts raster images only: JPG, PNG, WebP, GIF, ICO and AVIF. Max 5MB.
export async function POST(req: NextRequest) {
  const { response } = await requireUserOrRespond(req)
  if (response) return response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // SVG is intentionally rejected because same-origin SVG can contain active content.
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif',
    ]
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
    }
    const extensionMatchesMime = ext === 'ico'
      ? ['image/x-icon', 'image/vnd.microsoft.icon'].includes(file.type)
      : extToMime[ext] === file.type
    if (!extensionMatchesMime) {
      return NextResponse.json(
        { error: 'Extensão do arquivo não corresponde ao tipo informado.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size < 1 || file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo vazio ou muito grande. Máximo 5MB.' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = crypto.randomBytes(6).toString('hex')
    const filename = `${timestamp}-${randomStr}.${ext}`
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    if (!hasSupportedImageSignature(buffer, file.type)) {
      return NextResponse.json({ error: 'O conteúdo do arquivo não corresponde a uma imagem válida.' }, { status: 400 })
    }
    const uploadDirs = getUploadDirectories()
    for (const uploadDir of uploadDirs) {
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })
      await fs.writeFile(path.join(uploadDir, filename), buffer)
    }

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
