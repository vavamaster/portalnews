import { db } from './db'
import { generateArticle, generateSlug } from './ai-generator'
import { loadSeoSettings, getSiteName, getCityState } from './seo-helpers'

// ============= IA PERSONALITY: "ALTINHA" =============
// Altinha é a jornalista-IA do portal — o nome do portal, cidade e estado vêm
// dinamicamente das configurações de SEO em /admin > SEO. Não há nada hardcoded.

const ALTINHA_PERSONALITY_TEMPLATE = `Você é "Altinha", a jornalista-IA sênior do portal {SITE_NAME} ({SITE_URL}).

IDENTIDADE:
- Jornalista experiente (25+ anos de carreira simulada), especializada em cobertura local
{KNOWS_CITY_LINE}
- Tom: profissional mas acolhedor, como uma jornalista local que conhece a comunidade
- Escreve em português brasileiro, com naturalidade e fluência

PRINCÍPIOS JORNALÍSTICOS:
1. PRECISÃO: nunca inventa dados, números, nomes ou citações. Se não sabe, generaliza ("segundo fontes ouvidas", "a administração municipal informou")
2. CONTEXTO: sempre contextualiza o fato — não relata o quê, mas também o porquê e o impacto
3. LOCALISMO: {LOCALISM_RULE}
4. EQUILÍBRIO: apresenta múltiplos lados quando aplicável (governo vs oposição, produtor vs consumidor)
5. CLAREZA: linguagem acessível, evita jargão; se usa termo técnico, explica
6. ÉTICA: respeita presunção de inocência, não sensacionaliza tragédias, protege menores

ESCOPOS DE COBERTURA:
- LOCAL: fatos que acontecem NA cidade/ região (eventos, obras, políticas públicas, esportes locais)
- STATE: notícias do estado com impacto regional (agronegócio, meio ambiente, políticas estaduais)
- NATIONAL: notícias do Brasil contextualizadas para a cidade e a região
- WORLD: notícias internacionais com conexão local (commodities, clima, geopolítica)
- TRENDING: assuntos do momento em redes sociais e buscadores, com ângulo local

ESTRUTURA PADRÃO:
1. Lead (1º parágrafo): o que aconteceu, onde, quando, por que importa
2. Desenvolvimento: detalhes, contexto, dados
3. Impacto local: como isso afeta a cidade / região
4. Contextualização: histórico ou comparação
5. Próximos passos: o que esperar, onde acompanhar

FORMATO:
- Use markdown: ## subtítulos, **negrito** para destaques, > citações
- Mínimo 400, máximo 800 palavras
- Tags: 5-7 termos específicos (não apenas o nome do portal)

DIREITOS AUTORAIS:
- SEMPRE inclua campo "Fonte" em customFields
- Se baseou em dados de órgão externo (CEPEA, IBGE, BCB, ANP, CONAB), cite com link
- Se é matéria original, "Fonte: Redação {SITE_NAME}"

RETORNE APENAS JSON VÁLIDO:
{
  "title": "máx 80 chars",
  "subtitle": "máx 120 chars",
  "excerpt": "máx 200 chars",
  "content": "markdown completo",
  "tags": "tag1, tag2, ...",
  "seoTitle": "máx 60 chars",
  "seoDescription": "máx 160 chars",
  "seoKeywords": "palavra1, palavra2, ...",
  "customFields": [{"label": "Fonte", "value": "...", "link": "..."}, ...]
}`

// Build the Altinha personality prompt with the admin-configured site name + city/state.
function buildAltinhaPersonality(settings: Record<string, string>): string {
  const siteName = getSiteName(settings)
  const siteUrl = settings.site_url || 'http://localhost:3000'
  const cityState = getCityState(settings)
  const knowsCityLine = cityState
    ? `- Conhece profundamente ${cityState}, sua história, economia, cultura e pessoas`
    : '- Conhece profundamente a cidade e região de cobertura do portal, sua história, economia, cultura e pessoas'
  const localismRule = cityState
    ? `tudo que é global/nacional é "traduzido" para o impacto em ${cityState} e região`
    : 'tudo que é global/nacional é "traduzido" para o impacto na cidade e região de cobertura'
  return ALTINHA_PERSONALITY_TEMPLATE
    .replace(/{SITE_NAME}/g, siteName)
    .replace(/{SITE_URL}/g, siteUrl)
    .replace(/{KNOWS_CITY_LINE}/g, knowsCityLine)
    .replace(/{LOCALISM_RULE}/g, localismRule)
}

// ============= SCOPE PROMPTS =============
// The scope prompts are also templated so they reflect the actual portal's city/state.
function buildScopePrompts(settings: Record<string, string>): Record<string, string> {
  const cityState = getCityState(settings)
  const cityRef = cityState || 'a cidade'
  const stateRef = cityState ? `o estado de ${cityState.split(',')[1]?.trim() || 'cobertura'}` : 'o estado de cobertura'
  return {
    LOCAL: `Gere uma matéria LOCAL sobre ${cityRef}. Foque em fatos que acontecem na cidade: eventos, obras, políticas públicas, esportes locais, educação, saúde, cultura municipal. Contextualize sempre com a realidade local.`,
    STATE: `Gere uma matéria sobre ${stateRef} com impacto regional. Pode ser sobre agronegócio, meio ambiente, políticas estaduais, infraestrutura, ou economia. Sempre traga o impacto para ${cityRef} e região.`,
    NATIONAL: `Gere uma matéria NACIONAL contextualizada para ${cityRef}. Pegue um tema relevante do Brasil (economia, política federal, segurança, saúde pública, educação) e explique como afeta a cidade e a região.`,
    WORLD: `Gere uma matéria INTERNACIONAL com conexão local. Foque em eventos mundiais que afetam a região: preço de commodities, clima (El Niño/La Niña), geopolítica, acordos comerciais. Traduza o global para o impacto local.`,
    TRENDING: `Gere uma matéria sobre um assunto DO MOMENTO (trending). Pode ser algo viral nas redes sociais, um tema muito buscado no Google, ou um debate atual da sociedade brasileira. Dê um ângulo local: como esse assunto se reflete em ${cityRef}?`,
    CUSTOM: `Gere uma matéria conforme o tema específico fornecido.`,
  }
}

// Topic templates by scope — these are generic, city-agnostic topic ideas.
// (City/state get injected at prompt-build time from SEO settings, so we don't hardcode them here.)
export const TOPIC_TEMPLATES: Record<string, string[]> = {
  LOCAL: [
    'Evento cultural neste fim de semana na cidade',
    'Nova obra de infraestrutura urbana na cidade',
    'Resultado do campeonato regional de futebol amador',
    'Inauguração de novo estabelecimento comercial',
    'Campanha de saúde pública municipal',
    'Sessão da Câmara Municipal e decisões importantes',
    'Feira livre e movimentação do comércio local',
    'Ação social de instituições da cidade',
    'Educação: calendário escolar e eventos',
    'Clima e previsão para a semana na região',
  ],
  STATE: [
    'Safra de grãos no estado: expectativas e desafios',
    'Preço da arroba do boi gordo no estado',
    'Produção agropecuária do estado',
    'Período de cheias ou secas e impacto ambiental',
    'Políticas estaduais para o agronegócio',
    'Infraestrutura rodoviária estadual',
    'Economia do estado: indicadores do mês',
    'Meio ambiente: queimadas e preservação no estado',
    'Turismo nas regiões turísticas do estado',
    'Tecnologia no campo: drones e agricultura de precisão',
  ],
  NATIONAL: [
    'Economia brasileira: inflação e impacto no bolso',
    'Política federal e reflexos para o interior',
    'Preço dos combustíveis no Brasil',
    'Política agrícola do governo federal',
    'Sistema Único de Saúde (SUS) e atendimento no interior',
    'Educação: ENEM, Sisu e oportunidades para estudantes',
    'Segurança pública no Brasil e no interior',
    'Programas sociais e impacto em municípios pequenos',
    'Reforma administrativa e impacto em servidores',
    'Clima nacional: El Niño/La Niña e previsões',
  ],
  WORLD: [
    'Guerras e conflitos: impacto nas exportações brasileiras',
    'Preço internacional da soja e milho',
    'Mudanças climáticas globais e agricultura',
    'Acordos comerciais e o agronegócio brasileiro',
    'Geopolítica e mercado de commodities',
    'Tecnologia mundial: IA e impacto no agronegócio',
    'Pandemias e saúde global',
    'Energia renovável e o futuro do Brasil',
    'Dólar e câmbio: impacto para produtores',
    'Logística global e exportação de grãos',
  ],
  TRENDING: [
    'Assunto viral nas redes sociais esta semana',
    'Tema mais buscado no Google Trends Brasil',
    'Debate atual na sociedade brasileira',
    'Novidade tecnológica que está bombando',
    'Personalidade do momento e sua influência',
  ],
}

// ============= AUTO NEWS GENERATION =============

export async function generateAutoNews(schedule: any): Promise<{ success: boolean; post?: any; error?: string; duration?: number }> {
  const startTime = Date.now()
  console.debug(`[AutoNews] Running schedule "${schedule.name}" (scope: ${schedule.scope})`)

  try {
    // Load SEO settings so the AI prompt reflects the admin-configured site name + city/state.
    const settings = await loadSeoSettings()
    const scopePrompts = buildScopePrompts(settings)

    // Build the prompt based on scope + topic hint
    const scopePrompt = scopePrompts[schedule.scope] || scopePrompts.LOCAL
    
    // Pick a random topic template if no custom hint
    let topicHint = schedule.topicHint
    if (!topicHint && TOPIC_TEMPLATES[schedule.scope]) {
      const templates = TOPIC_TEMPLATES[schedule.scope]
      topicHint = templates[Math.floor(Math.random() * templates.length)]
    }

    // Use custom prompt template if provided
    let finalPrompt: string
    if (schedule.promptTemplate) {
      finalPrompt = schedule.promptTemplate
        .replace('{scope}', schedule.scope)
        .replace('{topic}', topicHint || '')
        .replace('{date}', new Date().toLocaleDateString('pt-BR'))
    } else {
      finalPrompt = `${scopePrompt}\n\nTema sugerido: ${topicHint || 'Escolha um tema relevante do momento'}\nData de referência: ${new Date().toLocaleDateString('pt-BR')}`
    }

    // Generate article using the AI generator with Altinha's personality (dynamic)
    const article = await generateArticleWithPersonality(finalPrompt, schedule.categorySlug, topicHint, settings)

    // Create the post in the database
    const slug = generateSlug(article.title)
    let uniqueSlug = slug
    let i = 1
    while (await db.post.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${i++}`
    }

    // Find category by slug
    let categoryId: string | null = null
    if (schedule.categorySlug) {
      const cat = await db.category.findUnique({ where: { slug: schedule.categorySlug } })
      if (cat) categoryId = cat.id
    }
    // If no category found, try to match from tags
    if (!categoryId) {
      // C5 fix: guard against undefined article.tags
      const tagsStr = (article.tags || '').toLowerCase()
      if (tagsStr) {
        const cats = await db.category.findMany()
        const matchedCat = cats.find(c =>
          tagsStr.includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(tagsStr.split(',')[0])
        )
        if (matchedCat) categoryId = matchedCat.id
      }
    }

    // If no category found, throw error (C6 fix: don't use empty string)
    if (!categoryId) {
      throw new Error('Nenhuma categoria encontrada no portal. Crie categorias antes de gerar notícias automáticas.')
    }

    // Find admin user for author (C6 fix: throw if not found instead of empty string)
    const adminUser = await db.user.findFirst({ where: { role: { in: ['MASTER', 'ADMIN'] } } })
    if (!adminUser) {
      throw new Error('Nenhum usuário MASTER encontrado para atribuir autoria.')
    }
    const authorId = adminUser.id

    const status = schedule.autoPublish ? 'PUBLISHED' : 'DRAFT'
    const now = new Date()

    if (!categoryId) throw new Error('Nenhuma categoria encontrada no banco de dados')

    const post = await db.post.create({
      data: {
        slug: uniqueSlug,
        title: article.title,
        subtitle: article.subtitle,
        excerpt: article.excerpt,
        content: article.content,
        tags: article.tags,
        coverImage: article.coverImage,
        gallery: article.gallery.length > 0 ? JSON.stringify(article.gallery) : null,
        customFields: article.customFields ? JSON.stringify(article.customFields) : null,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        seoKeywords: article.seoKeywords,
        ogImage: article.coverImage,
        categoryId,
        authorId,
        status,
        publishedAt: status === 'PUBLISHED' ? now : null,
        featured: false,
        breaking: false,
      },
    })

    const duration = Date.now() - startTime
    console.debug(`[AutoNews] ✓ Generated post "${article.title}" in ${duration}ms (status: ${status})`)

    return { success: true, post, duration }
  } catch (e: any) {
    const duration = Date.now() - startTime
    console.error(`[AutoNews] ✗ Failed:`, e.message)
    return { success: false, error: e.message, duration }
  }
}

// Generate article using Altinha's personality (built dynamically from SEO settings)
async function generateArticleWithPersonality(prompt: string, categorySlug?: string, topicHint?: string, settings?: Record<string, string>) {
  const { chatCompletion } = await import('./ai-provider')
  
  // Load settings if not passed in
  const seoSettings = settings || await loadSeoSettings()
  const siteName = getSiteName(seoSettings)
  const cityState = getCityState(seoSettings)
  
  // Get category name
  let categoryName: string | undefined
  if (categorySlug) {
    const cat = await db.category.findUnique({ where: { slug: categorySlug } })
    if (cat) categoryName = cat.name
  }

  const userPrompt = `Categoria sugerida: ${categoryName || 'Geral'}\n\n${prompt}\n\nGere a matéria completa no formato JSON especificado.`

  const messages: any[] = [
    { role: 'system', content: buildAltinhaPersonality(seoSettings) },
    { role: 'user', content: userPrompt },
  ]

  const response = await chatCompletion(messages, { json: true })
  const responseText = response.content

  // Parse JSON
  let article: any
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    article = JSON.parse(cleaned)
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      article = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('IA retornou formato inválido.')
    }
  }

  // Smart image search — use the ARTICLE TITLE + TAGS (not the instruction prompt)
  // The "prompt" variable contains meta-instructions like "Gere uma matéria NACIONAL..."
  // which produces irrelevant image results. We use the generated title and tags instead.
  const { extractImageKeywords, searchVariedImages } = await import('./ai-generator-utils')
  
  // Build a clean search query from the article title + topic hint
  const imageQuery = article.title || topicHint || ''
  const keywords = extractImageKeywords(imageQuery, article, categoryName)
  let coverImage = ''
  let gallery: string[] = []
  let imageSources: string[] = []

  try {
    const imageResults: any[] = await searchVariedImages(imageQuery, keywords, categoryName, 6)
    if (imageResults.length > 0) {
      coverImage = imageResults[0].url
      gallery = imageResults.slice(1, 5).map((r: any) => r.url)
      const allSources: string[] = imageResults.map((r: any) => r.source).filter((s: any): s is string => !!s && s.trim().length > 0)
      imageSources = [...new Set(allSources)]
    }
  } catch (e) {
    console.error('[AutoNews] Image search failed:', e)
  }

  // Build customFields with Fonte + Imagens — use the admin-configured site name (NOT a hardcoded brand).
  let customFields: any[] = Array.isArray(article.customFields) ? article.customFields : []
  if (!customFields.some((f: any) => f.label?.toLowerCase() === 'fonte')) {
    customFields.unshift({ label: 'Fonte', value: `Redação ${siteName}`, link: '' })
  }
  if (imageSources.length > 0 && !customFields.some((f: any) => f.label?.toLowerCase() === 'imagens')) {
    customFields.push({ label: 'Imagens', value: imageSources.slice(0, 5).join(', '), link: '' })
  }

  return {
    title: article.title || 'Sem título',
    subtitle: article.subtitle || '',
    excerpt: article.excerpt || '',
    content: article.content || '',
    tags: article.tags || '',
    seoTitle: article.seoTitle || article.title || '',
    seoDescription: article.seoDescription || article.excerpt || '',
    seoKeywords: article.seoKeywords || article.tags || '',
    coverImage,
    gallery,
    customFields,
  }
}

// ============= CRON RUNNER =============

export async function runScheduledNews(): Promise<{ generated: number; failed: number; skipped: number }> {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1=Mon, 7=Sun
  const currentDayOfMonth = now.getDate()

  console.debug(`[AutoNews] Cron check at ${now.toISOString()} (hour=${currentHour}, minute=${currentMinute}, dow=${currentDayOfWeek}, dom=${currentDayOfMonth})`)

  const schedules = await db.aINewsSchedule.findMany({
    where: { isEnabled: true },
  })

  let generated = 0
  let failed = 0
  let skipped = 0

  for (const schedule of schedules) {
    const shouldRun = checkSchedule(schedule, currentHour, currentMinute, currentDayOfWeek, currentDayOfMonth)
    
    if (!shouldRun) {
      skipped++
      continue
    }

    // Skip if already ran in the last 55 minutes
    if (schedule.lastRunAt) {
      const minutesSinceLastRun = (now.getTime() - schedule.lastRunAt.getTime()) / (1000 * 60)
      if (minutesSinceLastRun < 55) {
        console.debug(`[AutoNews] Skipping "${schedule.name}" — ran ${minutesSinceLastRun.toFixed(0)} min ago`)
        skipped++
        continue
      }
    }

    console.debug(`[AutoNews] Running schedule "${schedule.name}"`)
    const result = await generateAutoNews(schedule)

    // Update schedule tracking
    await db.aINewsSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        lastPostId: result.post?.id || null,
        runCount: { increment: 1 },
      },
    })

    // Log

    if (result.success) generated++
    else failed++
  }

  console.debug(`[AutoNews] Done: ${generated} generated, ${failed} failed, ${skipped} skipped`)
  return { generated, failed, skipped }
}

function checkSchedule(schedule: any, hour: number, minute: number, dow: number, dom: number): boolean {
  if (schedule.hour !== hour) return false
  if (schedule.minute !== minute) return false

  switch (schedule.frequency) {
    case 'HOURLY':
      return true // Any hour:minute match (minute should be 0)
    case 'DAILY':
      return true
    case 'WEEKLY':
      if (!schedule.daysOfWeek) return true
      try {
        const days = JSON.parse(schedule.daysOfWeek)
        return Array.isArray(days) && days.includes(dow)
      } catch {
        return true
      }
    case 'MONTHLY':
      return schedule.dayOfMonth === dom
    default:
      return false
  }
}
