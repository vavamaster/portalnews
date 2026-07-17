import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getPersistentUploadDirectory, isSafeUploadFilename } from '@/lib/upload-storage'

export const dynamic = 'force-dynamic'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  if (!isSafeUploadFilename(filename)) {
    return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  }

  try {
    const extension = path.extname(filename).toLowerCase()
    const contentType = CONTENT_TYPES[extension]
    if (!contentType) return NextResponse.json({ error: 'Tipo não suportado' }, { status: 415 })
    const file = await readFile(path.join(getPersistentUploadDirectory(), filename))
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch (error: any) {
    if (error?.code === 'ENOENT') return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    console.error('Upload read error:', error)
    return NextResponse.json({ error: 'Erro ao carregar arquivo' }, { status: 500 })
  }
}
