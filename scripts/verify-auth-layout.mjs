import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const projectRoot = new URL('../', import.meta.url)
const authViewPath = new URL('../src/components/portal/AuthView.tsx', import.meta.url)
const authView = await readFile(authViewPath, 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  authView.includes('max-w-lg flex-col items-stretch'),
  'O contêiner de autenticação precisa manter formulário e conteúdo auxiliar em coluna.',
)
assert(
  authView.includes('<aside className="mt-4 w-full'),
  'O cartão auxiliar do cadastro precisa ocupar a largura do formulário.',
)
assert(
  !authView.includes('max-w-md items-center justify-center'),
  'O padrão que comprimia horizontalmente o cadastro voltou ao AuthView.',
)

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectTsxFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.tsx')) files.push(path)
  }
  return files
}

const componentsRoot = join(projectRoot.pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1)), 'src', 'components')
const componentFiles = await collectTsxFiles(componentsRoot)
const suspicious = []

for (const file of componentFiles) {
  const source = await readFile(file, 'utf8')
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const horizontalConstrainedFlex = /className="[^"]*flex[^"]*w-full[^"]*max-w-[^"]*items-center[^"]*justify-center/.test(line)
    if (horizontalConstrainedFlex && !line.includes('flex-col')) suspicious.push(`${file}:${index + 1}`)
  }
}

assert(
  suspicious.length === 0,
  `Foram encontrados contêineres flexíveis potencialmente comprimidos: ${suspicious.join(', ')}`,
)

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
for (const pathname of ['/cadastro', '/entrar']) {
  const response = await fetch(`${baseUrl}${pathname}`)
  assert(response.ok, `${pathname} respondeu com status ${response.status}.`)
  const html = await response.text()
  assert(html.includes('PortalNews') || html.includes('Portal de'), `${pathname} não renderizou a identidade do portal.`)
}

console.log('Auth layout verification passed.')
