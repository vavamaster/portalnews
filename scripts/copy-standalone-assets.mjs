#!/usr/bin/env node

import { cp, mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const standaloneDir = path.join(rootDir, '.next', 'standalone')

function assertInsideWorkspace(targetPath) {
  const resolved = path.resolve(targetPath)
  if (resolved !== rootDir && !resolved.startsWith(`${rootDir}${path.sep}`)) {
    throw new Error(`Destino fora do workspace: ${resolved}`)
  }
  return resolved
}

async function copyDirectory(source, destination) {
  const resolvedSource = assertInsideWorkspace(source)
  const resolvedDestination = assertInsideWorkspace(destination)
  await stat(resolvedSource)
  await rm(resolvedDestination, { recursive: true, force: true })
  await mkdir(path.dirname(resolvedDestination), { recursive: true })
  await cp(resolvedSource, resolvedDestination, { recursive: true, force: true })
}

await stat(standaloneDir)
await copyDirectory(
  path.join(rootDir, '.next', 'static'),
  path.join(standaloneDir, '.next', 'static'),
)
await copyDirectory(
  path.join(rootDir, 'public'),
  path.join(standaloneDir, 'public'),
)

console.log('[copy-standalone-assets] static e public copiados para o standalone.')
