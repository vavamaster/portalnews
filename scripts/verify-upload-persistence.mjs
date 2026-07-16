import assert from 'node:assert/strict'
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const email = `upload-persistence-${Date.now()}@example.test`
let filename = ''

try {
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Teste Upload', email, password: 'UploadTest123!' }),
  })
  assert.equal(registration.status, 200, await registration.text())
  const cookie = registration.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(cookie, 'Registro não retornou cookie de sessão')

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'persistence.png')
  const upload = await fetch(`${baseUrl}/api/upload`, { method: 'POST', headers: { cookie }, body: form })
  if (upload.status !== 200) throw new Error(`Upload retornou ${upload.status}: ${await upload.text()}`)
  const data = await upload.json()
  filename = data.filename
  assert.ok(filename)

  const persistentPath = path.join(projectRoot, 'public', 'uploads', filename)
  const runtimePath = path.join(projectRoot, '.next', 'standalone', 'public', 'uploads', filename)
  assert.ok(existsSync(persistentPath), 'Arquivo não foi gravado no diretório persistente')
  assert.ok(existsSync(runtimePath), 'Arquivo não foi disponibilizado no runtime standalone')
  assert.equal((await fetch(`${baseUrl}${data.url}`)).status, 200)

  console.log('Upload persistence verification passed.')
} finally {
  if (filename) {
    await Promise.all([
      unlink(path.join(projectRoot, 'public', 'uploads', filename)).catch(() => {}),
      unlink(path.join(projectRoot, '.next', 'standalone', 'public', 'uploads', filename)).catch(() => {}),
    ])
  }
  await db.user.deleteMany({ where: { email } })
  await db.$disconnect()
}
