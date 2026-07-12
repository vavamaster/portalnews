import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { chatCompletion, type ChatMessage } from './ai-provider'
import { loadSeoSettings, getSiteName, getCityState } from './seo-helpers'

// ============= AI GENERATOR FOR NEWS ARTICLES =============

export interface GeneratedArticle {
  title: string
  subtitle: string
  excerpt: string
  content: string // markdown
  tags: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  coverImage: string
  gallery: string[]
  customFields: { label: string; value: string; link?: string }[]
}

export interface AITemplate {
  id: string
  name: string
  description: string
  icon: string
  category: string
  prompt: string
  suggestedCategory?: string
}

// Popular templates - one-click prompts for common news types
export const AI_TEMPLATES: AITemplate[] = [
  {
    id: 'sports-match',
    name: 'Jogo de Futebol',
    description: 'Cobertura de partida de futebol com resultado e destaques',
    icon: 'Trophy',
    category: 'Esportes',
    suggestedCategory: 'esportes',
    prompt: 'Escreva uma matéria completa sobre o jogo de futebol de hoje entre {timeA} e {timeB} pelo {competicao}. Placar final: {placar}. Destaques: {destaques}',
  },
  {
    id: 'political-event',
    name: 'Evento Político',
    description: 'Cobertura de sessão, votação ou decisão política',
    icon: 'Landmark',
    category: 'Política',
    suggestedCategory: 'politica',
    prompt: 'Escreva uma matéria sobre {evento_politico} que aconteceu hoje em {local}. Principais pontos: {pontos_principais}',
  },
  {
    id: 'police-incident',
    name: 'Ocorrência Policial',
    description: 'Notícia de polícia com fato, vítimas e investigação',
    icon: 'Shield',
    category: 'Polícia',
    suggestedCategory: 'policia',
    prompt: 'Escreva uma matéria sobre {ocorrencia} que aconteceu em {local} hoje. Detalhes disponíveis: {detalhes}',
  },
  {
    id: 'economic-news',
    name: 'Notícia Econômica',
    description: 'Indicadores econômicos, mercado, negócios',
    icon: 'TrendingUp',
    category: 'Economia',
    suggestedCategory: 'economia',
    prompt: 'Escreva uma matéria econômica sobre {tema}. Dados: {dados}. Impacto esperado: {impacto}',
  },
  {
    id: 'cultural-event',
    name: 'Evento Cultural',
    description: 'Festival, show, exposição, teatro',
    icon: 'Palette',
    category: 'Cultura',
    suggestedCategory: 'cultura',
    prompt: 'Escreva uma matéria sobre o evento cultural {nome_evento} que acontece em {periodo} em {local}. Atrações: {atracoes}',
  },
  {
    id: 'health-news',
    name: 'Saúde',
    description: 'Campanha, vigilância, nova unidade de saúde',
    icon: 'HeartPulse',
    category: 'Saúde',
    suggestedCategory: 'saude',
    prompt: 'Escreva uma matéria sobre saúde: {tema}. Contexto: {contexto}',
  },
  {
    id: 'education-news',
    name: 'Educação',
    description: 'Escolas, faculdades, resultado de provas',
    icon: 'GraduationCap',
    category: 'Educação',
    suggestedCategory: 'educacao',
    prompt: 'Escreva uma matéria sobre educação: {tema}. Detalhes: {detalhes}',
  },
  {
    id: 'agro-news',
    name: 'Agronegócio',
    description: 'Soja, gado, colheita, exportação',
    icon: 'Wheat',
    category: 'Agronegócio',
    suggestedCategory: 'agronegocio',
    prompt: 'Escreva uma matéria sobre agronegócio: {tema}. Dados: {dados}',
  },
  {
    id: 'breaking-news',
    name: 'Notícia de Última Hora',
    description: 'Fato relevante que acabou de acontecer',
    icon: 'Flame',
    category: 'Geral',
    suggestedCategory: 'geral',
    prompt: 'Escreva uma matéria de última hora sobre: {fato}. O que aconteceu: {detalhes}. Onde: {local}. Quando: {quando}',
  },
  {
    id: 'city-event',
    name: 'Evento da Cidade',
    description: 'Festa, inauguração, obra pública',
    icon: 'Building2',
    category: 'Geral',
    suggestedCategory: 'geral',
    prompt: 'Escreva uma matéria sobre o evento {nome_evento} em {local} em {data}. Informações: {informacoes}',
  },
  {
    id: 'interview',
    name: 'Entrevista',
    description: 'Entrevista com personalidade local',
    icon: 'Mic',
    category: 'Geral',
    suggestedCategory: 'geral',
    prompt: 'Escreva uma matéria no formato de entrevista com {entrevistado}, que é {cargo_ocupacao}. Tema: {tema}',
  },
  {
    id: 'tech-news',
    name: 'Tecnologia',
    description: 'Inovação, app, startup local',
    icon: 'Cpu',
    category: 'Tecnologia',
    suggestedCategory: 'tecnologia',
    prompt: 'Escreva uma matéria sobre tecnologia: {tema}. Detalhes: {detalhes}',
  },
]

const SYSTEM_PROMPT_TEMPLATE = `Você é um jornalista experiente do portal "{SITE_NAME}" ({SITE_URL}), um portal de notícias local{CITY_CLAUSE}.

REGRAS OBRIGATÓRIAS:
1. Escreva em português brasileiro, tom jornalístico profissional mas acessível
2. {LOCALIZATION_RULE}
3. Use markdown: ## para subtítulos, ### para seções, **negrito** para destaques, > para citações
4. Estrutura: lead (1º parágrafo resumindo), desenvolvimento, contexto, consequências
5. Mínimo 400 palavras, máximo 800
6. NÃO invente nomes de pessoas reais - use cargos genéricos ("o prefeito", "o secretário", "testemunhas")
7. NÃO invente dados numéricos específicos sem o usuário fornecer
8. Use linguagem clara, evitando jargão técnico
9. Termine com um parágrafo de contextualização ou próximo passo

DIREITOS AUTORAIS E FONTES — OBRIGATÓRIO:
- Se a matéria se baseia em informações de outro site, órgão público, ou fonte externa, SEMPRE inclua um campo "Fonte" em customFields com o nome da fonte e o link (URL) do site original.
- Se a matéria é original da redação do portal, use "Fonte: Redação {SITE_NAME}" sem link.
- Se a matéria referencia dados de CEPEA, IBGE, BCB, ANP, CONAB, ou outro órgão, inclua "Fonte" com o nome do órgão e o link oficial (ex: https://www.cepea.esalq.usp.br).
- Se a matéria é baseada em release oficial, inclua "Fonte: [Nome do órgão]" com o link do release.
- NUNCA copie texto integral de outros sites — sempre reescreva em suas próprias palavras.
- As imagens são buscadas separadamente da internet — não gere URLs de imagens no JSON.

CAMPOS PERSONALIZADOS (customFields):
Gere campos contextualizados e relevantes ao tema específico da matéria.
Cada categoria tem campos típicos — use 3-6 campos que façam sentido para o contexto:
- SEMPRE inclua um campo "Fonte" (com link quando aplicável) para atribuição de direitos.
- Esportes: Time Mandante, Time Visitante, Placar, Competição, Estádio, Destaques, Fonte
- Política: Órgão Responsável, Decisão, Impacto, Próximos Passos, Fonte
- Polícia: Tipo de Ocorrência, Local, Vítimas, Suspeito, Status da Investigação, Fonte
- Economia: Setor, Indicador, Variação, Impacto Esperado, Fonte
- Cultura: Atrações, Local do Evento, Período, Ingressos, Organização, Fonte
- Saúde: Tipo de Campanha, Público-Alvo, Local de Atendimento, Fonte
- Educação: Instituição, Modalidade, Público-Alvo, Resultado, Fonte
- Agronegócio: Produto, Safra/Período, Volume, Mercado, Fonte
- Geral: Local, Data, Contato para mais informações, Fonte

TAGS:
Gere 5-7 tags relevantes. As tags são usadas para buscar imagens na internet, então use termos descritivos e específicos do tema (ex: "boi gordo", "pecuária", "preço da arroba").

SEO:
- seoTitle: diferente do título principal, otimizado para busca (até 60 chars)
- seoDescription: diferente do excerpt, focando em palavras-chave (até 160 chars)
- seoKeywords: 5-7 palavras-chave relevantes

RETORNE APENAS JSON VÁLIDO (sem markdown, sem comentários) no formato:
{
  "title": "título chamativo, máximo 80 caracteres, sem aspas",
  "subtitle": "linha fina, máximo 120 caracteres",
  "excerpt": "resumo curto para listagens, máximo 200 caracteres",
  "content": "conteúdo em markdown completo",
  "tags": "tag1, tag2, tag3 (5-7 tags separadas por vírgula — use termos específicos do tema)",
  "seoTitle": "título SEO, máximo 60 caracteres",
  "seoDescription": "descrição SEO, máximo 160 caracteres",
  "seoKeywords": "palavra1, palavra2, palavra3",
  "customFields": [
    {"label": "Fonte", "value": "nome da fonte", "link": "URL da fonte ou vazio"},
    {"label": "Outro Campo", "value": "valor", "link": ""}
  ]
}`

// Build the system prompt with dynamic site name / city / state from SEO settings.
// No hardcoded brand — the prompt adapts to whatever the admin configured.
function buildSystemPrompt(settings: Record<string, string>): string {
  const siteName = getSiteName(settings)
  const siteUrl = settings.site_url || 'http://localhost:3000'
  const cityState = getCityState(settings)
  const cityClause = cityState ? ` de ${cityState}` : ''
  const localizationRule = cityState
    ? `Sempre que possível contextualize com ${cityState} ou região`
    : 'Sempre que possível contextualize com a cidade e região de cobertura do portal'
  return SYSTEM_PROMPT_TEMPLATE
    .replace(/{SITE_NAME}/g, siteName)
    .replace(/{SITE_URL}/g, siteUrl)
    .replace(/{CITY_CLAUSE}/g, cityClause)
    .replace(/{LOCALIZATION_RULE}/g, localizationRule)
}

// ============= SMART IMAGE SEARCH =============

// Try multiple paths for z-ai binary
function findZaiBinary(): string | null {
  const candidates = [
    '/usr/local/bin/z-ai',
    '/home/z/.bun/bin/z-ai',
    '/usr/bin/z-ai',
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

/**
 * Extract relevant image search keywords from the article.
 * Strategy: use tags (most contextual) + category, avoiding city names and long phrases.
 */
export function extractImageKeywords(prompt: string, article: any, categoryName?: string): string[] {
  const keywords: string[] = []

  // 0. USER PROMPT is the most reliable source — use it directly
  if (prompt) {
    const cleanPrompt = prompt
      .replace(/\{[^}]+\}/g, ' ')
      .replace(/[^\w\sáàâãéêíóôõúç]/gi, ' ')
      .trim()
    const promptWords = cleanPrompt.split(/\s+/).filter(w => w.length > 2)
    if (promptWords.length <= 8 && cleanPrompt.length > 3) {
      keywords.push(cleanPrompt.toLowerCase())
    }
  }

  // 1. Tags are the most contextual source
  if (article.tags) {
    const tags = article.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    // Take the 2-3 most relevant tags (excluding city names and generic terms)
    const cityNames = ['mato grosso', 'mt', 'brasil', 'região', 'regional']
    const genericTerms = ['notícia', 'noticia', 'hoje', 'ontem', 'cidade', 'prefeitura', 'governo']
    const relevantTags = tags.filter(t => {
      const lower = t.toLowerCase()
      return !cityNames.some(c => lower.includes(c)) &&
             !genericTerms.some(g => lower === g) &&
             t.length > 2
    })
    keywords.push(...relevantTags.slice(0, 3))
  }

  // 2. Add category name as fallback
  if (categoryName) {
    keywords.push(categoryName.toLowerCase())
  }

  // 3. Extract key nouns from title (avoid city names)
  if (article.title && keywords.length < 3) {
    const titleWords = article.title
      .toLowerCase()
      .replace(/[^a-záàâãéêíóôõúç\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
    const cityNames = ['alta', 'garças', 'garcas', 'mato', 'grossense']
    const stopWords = ['para', 'como', 'que', 'com', 'sem', 'sobre', 'após', 'antes', 'depois', 'ainda', 'hoje', 'ontem']
    const titleKeywords = titleWords.filter(w =>
      !cityNames.includes(w) &&
      !stopWords.includes(w) &&
      !keywords.some(k => k.includes(w) || w.includes(k))
    )
    keywords.push(...titleKeywords.slice(0, 2))
  }

  // Deduplicate and return
  return [...new Set(keywords)].slice(0, 4)
}

/**
 * Build multiple search queries for varied gallery images.
 * Each query should produce DIFFERENT image results.
 */
function buildImageQueries(prompt: string, keywords: string[], categoryName?: string): string[] {
  const queries: string[] = []

  // Query 1: THE USER PROMPT ITSELF — most relevant
  if (prompt) {
    const cleanPrompt = prompt.replace(/\{[^}]+\}/g, ' ').trim()
    if (cleanPrompt.length > 3) {
      queries.push(cleanPrompt.substring(0, 100))
    }
  }

  // Query 2: first 2 keywords from tags
  if (keywords.length >= 2) {
    queries.push(keywords.slice(0, 2).join(' '))
  } else if (keywords.length === 1 && queries.length === 0) {
    queries.push(keywords[0])
  }

  // Query 3: different keyword combination
  if (keywords.length >= 3) {
    queries.push(`${keywords[1]} ${keywords[2]}`)
  }

  // Query 4: category + first keyword
  if (categoryName && keywords.length > 0) {
    queries.push(`${categoryName.toLowerCase()} ${keywords[0]}`)
  }

  // Query 5: just the category for broader results
  if (categoryName && queries.length < 4) {
    queries.push(categoryName.toLowerCase())
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 5)
}

interface ImageResult {
  url: string
  source?: string
  caption?: string
}

// Search images and return FULL info (URL + source name + caption) for attribution
async function searchImagesWithSource(query: string, count: number = 3): Promise<ImageResult[]> {
  const { spawn } = await import('child_process')
  return new Promise((resolve) => {
    const binary = findZaiBinary()
    if (!binary) {
      console.error('[Image Search] z-ai binary not found')
      resolve([])
      return
    }

    const args = ['image-search', '--query', query, '--count', String(count), '--no-rank', '--gl', 'us']
    const proc: any = spawn(binary, args, {
      timeout: 90_000,
      env: {
        ...process.env,
        PATH: `/usr/local/bin:/home/z/.bun/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
      },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: any) => { stdout += data.toString() })
    proc.stderr.on('data', (data: any) => { stderr += data.toString() })

    proc.on('error', (err: any) => {
      console.error('[Image Search] Spawn error:', err.message)
      resolve([])
    })

    proc.on('close', (code: any) => {
      if (code !== 0) {
        console.error(`[Image Search] z-ai exited with code ${code}`)
        console.error('[Image Search] stderr:', stderr.substring(0, 300))
        resolve([])
        return
      }
      try {
        const lines = stdout.split('\n')
        let jsonStart = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('{')) {
            jsonStart = i
            break
          }
        }
        if (jsonStart === -1) {
          resolve([])
          return
        }
        const jsonText = lines.slice(jsonStart).join('\n')
        const data = JSON.parse(jsonText)
        if (data.success && Array.isArray(data.results)) {
          const results: ImageResult[] = data.results
            .map((r: any) => ({
              url: r.original_url,
              source: r.source || '',
              caption: r.caption || '',
            }))
            .filter((r: any) => r.url)
          resolve(results)
        } else {
          resolve([])
        }
      } catch (e) {
        console.error('[Image Search] Parse error:', e)
        resolve([])
      }
    })
  })
}

/**
 * Search for images using multiple queries to get VARIED results.
 * Returns an array of UNIQUE image URLs.
 */
export async function searchVariedImages(prompt: string, keywords: string[], categoryName?: string, totalNeeded: number = 6): Promise<ImageResult[]> {
  const queries = buildImageQueries(prompt, keywords, categoryName)
  console.debug('[Image Search] Queries:', queries)

  const allResults: ImageResult[] = []
  const seenUrls = new Set<string>()

  for (const query of queries) {
    if (allResults.length >= totalNeeded) break
    try {
      console.debug(`[Image Search] Searching: "${query}"`)
      const results = await searchImagesWithSource(query, 4)
      console.debug(`[Image Search] Got ${results.length} results for "${query}"`)
      for (const r of results) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url)
          allResults.push(r)
          if (allResults.length >= totalNeeded) break
        }
      }
    } catch (e) {
      console.error(`[Image Search] Failed for query "${query}":`, e)
    }
  }

  console.debug(`[Image Search] Total unique images: ${allResults.length}`)
  return allResults
}

export async function generateArticle(prompt: string, categoryName?: string): Promise<GeneratedArticle> {
  // 0. Load SEO settings so the AI prompt reflects the admin-configured site name / city / state.
  const settings = await loadSeoSettings()
  const siteName = getSiteName(settings)

  // 1. Generate article content via configured AI provider
  const userPrompt = `Categoria sugerida: ${categoryName || 'Geral'}\n\nSolicitação do editor:\n${prompt}\n\nGere a matéria completa no formato JSON especificado.`

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(settings) },
    { role: 'user', content: userPrompt },
  ]

  const response = await chatCompletion(messages, { json: true })
  const responseText = response.content

  // Parse JSON (handle markdown code blocks)
  let article: any
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    article = JSON.parse(cleaned)
  } catch (e) {
    // Fallback: extract with regex
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      article = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('IA retornou formato inválido. Tente novamente com prompt mais específico.')
    }
  }

  // 2. Smart image search — use the USER PROMPT as primary query, then tags as secondary
  const keywords = extractImageKeywords(prompt, article, categoryName)
  console.debug('[AI Generator] Image search keywords:', keywords)

  let coverImage = ''
  let gallery: string[] = []
  let imageSources: string[] = [] // for attribution

  // Search for varied images using multiple queries
  // The FIRST query is always the user's original prompt (e.g. "bolo de chocolate")
  try {
    const imageResults = await searchVariedImages(prompt, keywords, categoryName, 6)
    console.debug(`[AI Generator] Found ${imageResults.length} unique images`)
    if (imageResults.length > 0) {
      // Cover: use the first image
      coverImage = imageResults[0].url
      // Gallery: use the REMAINING images (different from cover) — no duplicates
      gallery = imageResults.slice(1, 5).map(r => r.url)
      // Collect image sources for attribution (unique, non-empty)
      const allSources = imageResults
        .map(r => r.source)
        .filter((s): s is string => !!s && s.trim().length > 0)
      imageSources = [...new Set(allSources)]
      console.debug('[AI Generator] Image sources:', imageSources)
    }
  } catch (e) {
    console.error('[AI Generator] Image search failed:', e)
  }

  // NO FALLBACK to loremflickr or any placeholder service.
  // If no images were found, coverImage stays empty — the editor will upload manually.
  // This prevents random/irrelevant placeholder images from appearing in articles.

  // 3. Build customFields — ensure "Fonte" is present, and add image attribution
  let customFields: any[] = Array.isArray(article.customFields) ? article.customFields : []
  // Ensure "Fonte" field exists
  if (!customFields.some((f: any) => f.label?.toLowerCase() === 'fonte')) {
    customFields.unshift({ label: 'Fonte', value: `Redação ${siteName}`, link: '' })
  }
  // Add image attribution field if we have sources
  if (imageSources.length > 0) {
    const attributionValue = imageSources.slice(0, 5).join(', ')
    // Check if there's already an "Imagens" field
    if (!customFields.some((f: any) => f.label?.toLowerCase() === 'imagens')) {
      customFields.push({ label: 'Imagens', value: attributionValue, link: '' })
    }
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

// Generate a slug from a title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 80)
}
