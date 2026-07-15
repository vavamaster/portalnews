import { NextRequest, NextResponse } from 'next/server'

const STATIC_VIEWS: Record<string, string> = {
  login: '/entrar',
  register: '/cadastro',
  profile: '/minha-conta',
  credits: '/meus-creditos',
  store: '/anuncie',
  about: '/sobre',
  contact: '/contato',
  classifieds: '/classificados',
  plans: '/planos',
  advertiser: '/painel-anunciante',
  editors: '/editores',
  'editor-bio-edit': '/editores/meu-perfil/editar',
  quotes: '/cotacoes',
  enterprise: '/empresa/painel',
}

function segment(value: string) {
  return encodeURIComponent(value.trim())
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') return NextResponse.next()
  const params = request.nextUrl.searchParams
  let pathname = ''
  let search = ''

  if (params.get('article')) pathname = `/noticias/${segment(params.get('article')!)}`
  else if (params.get('category')) pathname = `/categoria/${segment(params.get('category')!)}`
  else if (params.get('search')) {
    pathname = '/buscar'
    search = `?q=${encodeURIComponent(params.get('search')!.trim())}`
  } else if (params.get('tag')) pathname = `/tag/${segment(params.get('tag')!)}`
  else if (params.get('classified')) pathname = `/classificados/anuncio/${segment(params.get('classified')!)}`
  else if (params.get('ccat')) pathname = `/classificados/categoria/${segment(params.get('ccat')!)}`
  else if (params.get('editor')) pathname = `/editores/${segment(params.get('editor')!)}`
  else if (params.get('empresa')) pathname = `/empresa/${segment(params.get('empresa')!)}`
  else if (params.get('view') === 'classified-editor') {
    pathname = params.get('id') ? `/classificados/editar/${segment(params.get('id')!)}` : '/classificados/anunciar'
  } else if (params.get('view') === 'admin') {
    pathname = '/admin'
    const adminParams = new URLSearchParams()
    if (params.get('section')) adminParams.set('section', params.get('section')!)
    if (params.get('postId')) adminParams.set('postId', params.get('postId')!)
    search = adminParams.size ? `?${adminParams}` : ''
  } else if (params.get('view') && STATIC_VIEWS[params.get('view')!]) {
    pathname = STATIC_VIEWS[params.get('view')!]
  }

  if (!pathname) return NextResponse.next()
  const destination = request.nextUrl.clone()
  destination.pathname = pathname
  destination.search = search
  return NextResponse.redirect(destination, 308)
}

export const config = { matcher: '/' }
