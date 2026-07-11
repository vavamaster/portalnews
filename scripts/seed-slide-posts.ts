import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Seeding slide posts...')

  const admin = await db.user.findUnique({ where: { email: 'admin@portal.com' } })
  if (!admin) { console.log('⚠️ Admin not found'); return }

  const cats = await db.category.findMany()
  const catMap: Record<string, string> = {}
  for (const c of cats) catMap[c.slug] = c.id

  const slidePosts = [
    // Política
    { slug: 'prefeito-anuncia-novo-hospital', title: 'Prefeito anuncia construção de novo hospital regional', subtitle: 'Obra de R$ 15 milhões deve iniciar em agosto', categorySlug: 'politica', coverImage: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&h=600&fit=crop', featured: true, tags: 'prefeitura,saude,hospital,obra', content: '## Novo hospital\n\nO prefeito de a cidade anunciou nesta segunda-feira a construção de um novo hospital regional...\n\n> "Esta é uma obra histórica para nossa cidade", afirmou o prefeito.' },
    { slug: 'camara-aprova-lei-transparencia', title: 'Câmara aprova lei de transparência total', subtitle: 'Documentos públicos serão disponíveis em portal online', categorySlug: 'politica', coverImage: 'https://images.unsplash.com/photo-1565891741441-64926e441838?w=1200&h=600&fit=crop', featured: true, tags: 'camara,transparencia,lei', content: '## Lei aprovada\n\nA Câmara Municipal aprovou por unanimidade...' },

    // Polícia
    { slug: 'operacao-lei-seca-fim-de-semana', title: 'Operação Lei Seca blinda fim de semana', subtitle: 'Blitz em pontos estratégicos da cidade', categorySlug: 'policia', coverImage: 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&h=600&fit=crop', featured: true, breaking: true, tags: 'policia,lei seca,blitz', content: '## Operação\n\nA Polícia Militar intensificou a fiscalização...' },
    { slug: 'furto-centro-comercial-identificado', title: 'Suspeito de furto em comércio do centro é identificado', subtitle: 'Imagens de câmera de segurança ajudaram na identificação', categorySlug: 'policia', coverImage: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200&h=600&fit=crop', featured: false, tags: 'policia,furto,seguranca', content: '## Identificação\n\nA Polícia Civil identificou...' },

    // Esportes
    { slug: 'time-local-classifica-final', title: 'a cidade FC classifica-se para final do estadual', subtitle: 'Vitória por 2x0 garante vaga na decisão', categorySlug: 'esportes', coverImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=600&fit=crop', featured: true, tags: 'futebol,agfc,final,estadual', content: '## Classificação!\n\nO a cidade FC garantiu vaga na final...' },
    { slug: 'atleta-local-ganha-medalha', title: 'Atleta de a cidade ganha medalha em campeonato nacional', subtitle: 'Jovem promessa do atletismo MT brilha em São Paulo', categorySlug: 'esportes', coverImage: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&h=600&fit=crop', featured: true, tags: 'atletismo,medalha,nacional', content: '## Medalha conquistada\n\nA jovem atleta...' },

    // Economia
    { slug: 'comercio-da-cidade-cresce-15', title: 'Comércio de a cidade cresce 15% no semestre', subtitle: 'Setor de varejo lidera o crescimento', categorySlug: 'economia', coverImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=600&fit=crop', featured: true, tags: 'comercio,economia,crescimento,varejo', content: '## Crescimento\n\nO comércio varejista de a cidade...' },
    { slug: 'novo-banco-chega-cidade', title: 'Nova instituição bancária chega a a cidade', subtitle: 'Agência deve gerar 30 empregos diretos', categorySlug: 'economia', coverImage: 'https://images.unsplash.com/photo-1448653791780-61daca177be3?w=1200&h=600&fit=crop', featured: false, tags: 'banco,economia,empregos', content: '## Novo banco\n\nUma nova instituição bancária...' },

    // Cultura
    { slug: 'festival-de-inverno-2026', title: 'Festival de Inverno movimenta a cidade com 3 dias de shows', subtitle: 'Mais de 20 atrações confirmadas', categorySlug: 'cultura', coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=600&fit=crop', featured: true, tags: 'cultura,festival,musica,inverno', content: '## Festival de Inverno\n\nA Praça Central recebe...' },
    { slug: 'exposicao-artes-plasticas', title: 'Exposição de Artes Plásticas abre no Centro Cultural', subtitle: 'Obras de 15 artistas locais em mostra gratuita', categorySlug: 'cultura', coverImage: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&h=600&fit=crop', featured: false, tags: 'cultura,arte,exposicao', content: '## Exposição\n\nO Centro Cultural de a cidade...' },

    // Educação
    { slug: 'escola-municipal-premio-nacional', title: 'Escola Municipal recebe prêmio nacional de educação', subtitle: 'Projeto de leitura foi destaque entre 5 mil escolas', categorySlug: 'educacao', coverImage: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&h=600&fit=crop', featured: true, tags: 'educacao,premio,escola,leitura', content: '## Reconhecimento\n\nA Escola Municipal Monteiro Lobato...' },
    { slug: 'concurso-publico-prefeitura', title: 'Prefeitura abre concurso público com 50 vagas', subtitle: 'Inscrições abrem na próxima segunda-feira', categorySlug: 'educacao', coverImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=600&fit=crop', featured: false, tags: 'concurso,educacao,prefeitura,vagas', content: '## Concurso público\n\nA Prefeitura de a cidade...' },

    // Saúde
    { slug: 'nova-ubs-primavera', title: 'Nova UBS é inaugurada no bairro Primavera', subtitle: 'Equipamento atende 12 mil moradores', categorySlug: 'saude', coverImage: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&h=600&fit=crop', featured: true, tags: 'saude,ubs,inauguracao', content: '## Inauguração\n\nA Prefeitura inaugurou...' },
    { slug: 'campanha-vacinacao-gripe', title: 'Campanha de vacinação contra gripe atinge 80% do público', subtitle: 'Meta é imunizar 90% até final do mês', categorySlug: 'saude', coverImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&h=600&fit=crop', featured: false, tags: 'saude,vacina,gripe,campanha', content: '## Campanha\n\nA campanha de vacinação...' },

    // Agronegócio
    { slug: 'soja-recorde-exportacao', title: 'Soja bate recorde de exportação no trimestre', subtitle: 'Crescimento de 23% em relação ao ano anterior', categorySlug: 'agronegocio', coverImage: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200&h=600&fit=crop', featured: true, tags: 'soja,agronegocio,exportacao', content: '## Recorde\n\nO agronegócio de a cidade...' },
    { slug: 'leilao-gado-brangus', title: 'Leilão de gado Brangus movimenta R$ 2 milhões em a cidade', subtitle: 'Eventos pecuários aquecem economia local', categorySlug: 'agronegocio', coverImage: 'https://images.unsplash.com/photo-1605280015904-3446b7c6f5f9?w=1200&h=600&fit=crop', featured: false, tags: 'gado,leilao,pecuaria', content: '## Leilão\n\nO leilão de gado Brangus...' },

    // Tecnologia
    { slug: 'startup-agroconecta', title: 'Startup local lança app que conecta produtores a compradores', subtitle: 'Plataforma já conta com 500 produtores cadastrados', categorySlug: 'tecnologia', coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop', featured: true, tags: 'tecnologia,startup,agro,app', content: '## Inovação\n\nUma startup fundada por jovens...' },
    { slug: 'wifi-gratuito-centro', title: 'Wi-Fi gratuito chega ao centro de a cidade', subtitle: 'Projeto cobre praça e ruas principais', categorySlug: 'tecnologia', coverImage: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=1200&h=600&fit=crop', featured: false, tags: 'tecnologia,wifi,internet,cidade', content: '## Wi-Fi gratuito\n\nO centro de a cidade...' },

    // Geral
    { slug: 'carnaval-2026-alta-garcas', title: 'Carnaval 2026: a cidade promete maior festa da região', subtitle: 'Blocos, shows e estrutura turística em preparação', categorySlug: 'geral', coverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=600&fit=crop', featured: true, tags: 'carnaval,festa,turismo,2026', content: '## Carnaval 2026\n\nA Prefeitura de a cidade...' },
    { slug: 'obra-asfalto-bairros', title: 'Recapeamento asfáltico atinge 10 bairros de a cidade', subtitle: 'Investimento de R$ 3 milhões em infraestrutura', categorySlug: 'geral', coverImage: 'https://images.unsplash.com/photo-1545459720-aac8509eb02c?w=1200&h=600&fit=crop', featured: false, tags: 'obras,asfalto,infraestrutura,bairros', content: '## Recapeamento\n\nO recapeamento asfáltico...' },
  ]

  for (const p of slidePosts) {
    const catId = catMap[p.categorySlug]
    if (!catId) continue
    const existing = await db.post.findUnique({ where: { slug: p.slug } })
    if (existing) continue
    await db.post.create({
      data: {
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        excerpt: p.subtitle,
        content: p.content,
        coverImage: p.coverImage,
        tags: p.tags,
        categoryId: catId,
        authorId: admin.id,
        status: 'PUBLISHED',
        featured: p.featured || false,
        breaking: (p as any).breaking || false,
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        seoTitle: p.title,
        seoDescription: p.subtitle,
        ogImage: p.coverImage,
        views: Math.floor(Math.random() * 3000) + 100,
      } as any,
    })
  }
  console.log(`✅ ${slidePosts.length} slide posts seeded`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
