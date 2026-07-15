const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

function check(condition, message) {
  if (!condition) throw new Error(message)
  console.log(`ok - ${message}`)
}

async function response(path, init = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init })
}

const postsData = await fetch(`${baseUrl}/api/posts?limit=1`).then(item => item.json())
const categoriesData = await fetch(`${baseUrl}/api/categories`).then(item => item.json())
const listingsData = await fetch(`${baseUrl}/api/classifieds?limit=1`).then(item => item.json())
const post = postsData.posts?.[0]
const category = categoriesData.categories?.[0]
const listing = listingsData.listings?.[0]

check(Boolean(post?.slug), 'existe notÃ­cia publicada para validar')
check(Boolean(category?.slug), 'existe categoria para validar')

const articlePath = `/noticias/${encodeURIComponent(post.slug)}`
const articleResponse = await response(articlePath)
const articleHtml = await articleResponse.text()
check(articleResponse.status === 200, `${articlePath} responde 200`)
check(articleHtml.includes(`<link rel="canonical" href="${baseUrl}${articlePath}"`), 'canonical da notÃ­cia usa URL amigÃ¡vel')

const legacyArticle = await response(`/?article=${encodeURIComponent(post.slug)}`)
check(legacyArticle.status === 308, 'URL antiga da notÃ­cia redireciona permanentemente')
check(legacyArticle.headers.get('location') === articlePath, 'redirecionamento da notÃ­cia remove parÃ¢metros antigos')

const legacyArticlePath = await response(`/article/${encodeURIComponent(post.slug)}`)
check(legacyArticlePath.status === 308 && legacyArticlePath.headers.get('location') === articlePath, 'rota /article migra para /noticias')

const categoryPath = `/categoria/${encodeURIComponent(category.slug)}`
check((await response(categoryPath)).status === 200, `${categoryPath} responde 200`)
const legacyCategory = await response(`/?category=${encodeURIComponent(category.slug)}`)
check(legacyCategory.status === 308 && legacyCategory.headers.get('location') === categoryPath, 'categoria antiga redireciona sem query string')

if (listing?.slug) {
  const listingPath = `/classificados/anuncio/${encodeURIComponent(listing.slug)}`
  check((await response(listingPath)).status === 200, `${listingPath} responde 200`)
  const legacyListing = await response(`/?classified=${encodeURIComponent(listing.slug)}`)
  check(legacyListing.status === 308 && legacyListing.headers.get('location') === listingPath, 'classificado antigo redireciona para caminho amigÃ¡vel')
}

for (const path of ['/classificados', '/sobre', '/contato', '/cotacoes', '/editores', '/buscar?q=portal']) {
  check((await response(path)).status === 200, `${path} responde 200`)
}

const legacyAbout = await response('/?view=about')
check(legacyAbout.status === 308 && legacyAbout.headers.get('location') === '/sobre', 'pÃ¡gina institucional antiga redireciona para /sobre')

const sitemap = await fetch(`${baseUrl}/sitemap.xml`).then(item => item.text())
check(sitemap.includes(`${baseUrl}${articlePath}`), 'sitemap publica a URL amigÃ¡vel da notÃ­cia')
check(!sitemap.includes('?article=') && !sitemap.includes('?category='), 'sitemap nÃ£o publica rotas legadas')

console.log('Todas as URLs amigÃ¡veis foram validadas.')
