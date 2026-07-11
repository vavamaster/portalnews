/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/resolve-symlinks.js
// Resolves symlinks in .next/standalone that cause tar failures on deploy platforms.
//
// Problem: Next.js standalone mode creates relative symlinks like:
//   .next/standalone/.next/node_modules/@prisma/client-2c3a283f134fdcb6
//     → ../../../node_modules/@prisma/client
//
// When deploy platforms (like Alibaba Function Compute) try to tar the build output,
// these relative symlinks cause "Directory renamed before its status could be extracted"
// errors, resulting in CAExited / 502 Bad Gateway.
//
// Solution: Replace all symlinks with real copies (or remove them if the target already
// exists at the expected location).

const fs = require('fs')
const path = require('path')

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone')

if (!fs.existsSync(standaloneDir)) {
  console.log('[resolve-symlinks] .next/standalone does not exist, skipping')
  process.exit(0)
}

let resolved = 0
let removed = 0
let errors = 0

function resolveSymlinks(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        const target = fs.readlinkSync(fullPath)
        const resolvedTarget = path.resolve(dir, target)
        if (fs.existsSync(resolvedTarget)) {
          // Check if it's a directory or file
          const stat = fs.statSync(resolvedTarget)
          fs.unlinkSync(fullPath)
          if (stat.isDirectory()) {
            copyDirRecursive(resolvedTarget, fullPath)
          } else {
            fs.copyFileSync(resolvedTarget, fullPath)
          }
          resolved++
          console.log(`[resolve-symlinks] ✓ Resolved: ${path.relative(standaloneDir, fullPath)} → ${target}`)
        } else {
          // Broken symlink — remove it
          fs.unlinkSync(fullPath)
          removed++
          console.log(`[resolve-symlinks] ✗ Removed broken symlink: ${path.relative(standaloneDir, fullPath)}`)
        }
      } catch (e) {
        errors++
        console.error(`[resolve-symlinks] Error processing ${fullPath}:`, e.message)
      }
    } else if (entry.isDirectory()) {
      // Recurse into subdirectories (but skip node_modules to avoid deep traversal)
      // Actually we DO want to traverse .next/node_modules since that's where the problem is
      resolveSymlinks(fullPath)
    }
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else if (entry.isSymbolicLink()) {
      // Resolve nested symlinks too
      const target = fs.readlinkSync(srcPath)
      const resolved = path.resolve(src, target)
      if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved)
        if (stat.isDirectory()) {
          copyDirRecursive(resolved, destPath)
        } else {
          fs.copyFileSync(resolved, destPath)
        }
      }
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

console.log('[resolve-symlinks] Resolving symlinks in .next/standalone...')
resolveSymlinks(standaloneDir)
console.log(`[resolve-symlinks] Done. Resolved: ${resolved}, Removed: ${removed}, Errors: ${errors}`)
