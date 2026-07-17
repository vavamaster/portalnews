import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDir = path.resolve(import.meta.dirname, '..')
const envPath = path.join(rootDir, '.env')
const serverPath = path.join(rootDir, '.next', 'standalone', 'server.js')

if (fs.existsSync(envPath)) process.loadEnvFile(envPath)
process.env.NODE_ENV = 'production'

if (!fs.existsSync(serverPath)) {
  throw new Error('Build standalone não encontrado. Execute npm run build antes de iniciar.')
}

await import(pathToFileURL(serverPath).href)
