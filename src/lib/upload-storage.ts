import path from 'path'

export function getRuntimeUploadDirectory(cwd = process.cwd()): string {
  return path.join(cwd, 'public', 'uploads')
}

export function getPersistentUploadDirectory(cwd = process.cwd()): string {
  if (process.env.PERSISTENT_UPLOAD_DIR) return path.resolve(process.env.PERSISTENT_UPLOAD_DIR)
  const isStandaloneRuntime = path.basename(cwd).toLowerCase() === 'standalone'
    && path.basename(path.dirname(cwd)).toLowerCase() === '.next'
  return isStandaloneRuntime
    ? path.resolve(cwd, '..', '..', 'public', 'uploads')
    : getRuntimeUploadDirectory(cwd)
}

export function getUploadDirectories(cwd = process.cwd()): string[] {
  return [...new Set([getPersistentUploadDirectory(cwd), getRuntimeUploadDirectory(cwd)])]
}

export function isSafeUploadFilename(filename: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(filename)
}
