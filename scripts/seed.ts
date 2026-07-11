import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  console.log('🌱 Seeding database...')

  // ---------- SEO ----------
  const seoDefaults = [
    { key: 'site_name', value: 'Portal de Notícias' },
    { key: 'site_url', value: 'http://localhost:3000' },
    { key: 'site_description', value: 'Portal de notícias de a cidade e região. Política, esportes, economia, cultura, polícia e mais.' },
    { key: 'site_keywords', value: 'notícias,portal,jornalismo,cidade,região' },
    { key: 'og_image', value: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&h=630&fit=crop' },
    { key: 'twitter_card', value: 'summary_large_image' },
    { key: 'fb_app_id', value: '' },
    { key: 'google_analytics_id', value: '' },
    { key: 'facebook_url', value: '' },
    { key: 'instagram_url', value: '' },
    { key: 'twitter_url', value: '' },
    { key: 'youtube_url', value: '' },
    { key: 'whatsapp_url', value: 'https://wa.me/5566000000000' },
    { key: 'points_per_read', value: '10' },
    { key: 'max_reads_per_post', value: '50' },
    { key: 'points_per_reaction', value: '5' },
    { key: 'max_reactions_per_post', value: '30' },
    { key: 'credits_conversion_rate', value: '10' },
    { key: 'free_ad_cost_credits', value: '20' },
  ]
  for (const s of seoDefaults) {
    await db.seoSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    })
  }

  // ---------- MASTER ADMIN USER ----------
  const adminEmail = 'admin@portal.com'
  const existing = await db.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    const pwd = await hashPassword('admin123')
    await db.user.create({
      data: {
        email: adminEmail,
        name: 'Administrador Master',
        password: pwd,
        role: 'MASTER',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=c2410c&textColor=fff',
        bio: 'Administrador master do portal a cidade',
      },
    })
    console.log('✅ Master admin created: admin@portal.com / admin123')
  }

  const editorEmail = 'editor@portal.com'
  if (!(await db.user.findUnique({ where: { email: editorEmail } }))) {
    await db.user.create({
      data: {
        email: editorEmail,
        name: 'Editor Demo',
        password: await hashPassword('editor123'),
        role: 'EDITOR',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Editor&backgroundColor=0369a1&textColor=fff',
      },
    })
  }

  // ---------- CATEGORIES ----------
  const categories = [
    { slug: 'politica', name: 'Política', color: 'rose', icon: 'Landmark', description: 'Notícias da política local, estadual e nacional.' },
    { slug: 'policia', name: 'Polícia', color: 'red', icon: 'Shield', description: 'Cidade, segurança e ocorrências.' },
    { slug: 'esportes', name: 'Esportes', color: 'emerald', icon: 'Trophy', description: 'Futebol, vôlei, atletismo e mais.' },
    { slug: 'economia', name: 'Economia', color: 'amber', icon: 'TrendingUp', description: 'Mercado, negócios e finanças.' },
    { slug: 'cultura', name: 'Cultura', color: 'purple', icon: 'Palette', description: 'Arte, música, teatro e tradição.' },
    { slug: 'educacao', name: 'Educação', color: 'sky', icon: 'GraduationCap', description: 'Escolas, faculdades e ensino.' },
    { slug: 'saude', name: 'Saúde', color: 'teal', icon: 'HeartPulse', description: 'Saúde pública e bem-estar.' },
    { slug: 'agronegocio', name: 'Agronegócio', color: 'lime', icon: 'Wheat', description: 'Fazenda, soja, gado e campo.' },
    { slug: 'tecnologia', name: 'Tecnologia', color: 'indigo', icon: 'Cpu', description: 'Inovação, internet e gadgets.' },
    { slug: 'geral', name: 'Geral', color: 'slate', icon: 'Newspaper', description: 'Últimas notícias e variedades.' },
  ]
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    await db.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, order: i },
    })
  }

  // ---------- POSTS ----------
  const admin = await db.user.findUnique({ where: { email: adminEmail } })
  const cats = await db.category.findMany()

  const samplePosts = [
    {
      slug: 'camara-aprova-orcamento-2026',
      title: 'Câmara Municipal aprova orçamento de R$ 85 milhões para 2026',
      subtitle: 'Projeto prevê investimentos em saúde, educação e infraestrutura urbana',
      excerpt: 'Após quatro horas de discussão, vereadores aprovaram por unanimidade o orçamento que destination R$ 30 milhões para saúde.',
      content: `## Destaques do orçamento

A **Câmara Municipal de a cidade** aprovou na noite desta terça-feira o projeto de lei orçamentária para o exercício de 2026, totalizando **R$ 85 milhões** em investments previstos.

### Principais áreas contempladas

- **Saúde**: R$ 30 milhões (ampliação da UPA e novo centro de especialidades)
- **Educação**: R$ 22 milhões (construção de 2 novas escolas)
- **Infraestrutura**: R$ 18 milhões (recapeamento asfáltico)
- **Assistência Social**: R$ 8 milhões
- **Cultura e Esporte**: R$ 4 milhões
- **Administração**: R$ 3 milhões

> "Este orçamento reflete o compromisso desta gestão com a melhoria da qualidade de vida dos alta-garcenses", afirmou o prefeito durante a sessão.

A oposição criticou a redução de verbas para a cultura, mas o governo justificou que o valor será compensado com editais de fomento ao setor.

A próxima etapa agora é o envio do projeto para sanção do prefeito, que tem prazo de 15 dias úteis para sancionar ou vetar itens.`,
      coverImage: 'https://images.unsplash.com/photo-1565891741441-64926e441838?w=1200&h=600&fit=crop',
      gallery: JSON.stringify([
        'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1589577529967-2d406b908eff?w=800&h=600&fit=crop',
      ]),
      videos: JSON.stringify([
        { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', type: 'youtube', caption: 'Sessão plenária na íntegra' }
      ]),
      customFields: JSON.stringify([
        { label: 'Fonte Oficial', value: 'Câmara Municipal', link: 'https://cm-cidade.gov.br' },
        { label: 'Documento Completo', value: 'Lei 2.345/2026 (PDF)', link: '#' },
        { label: 'Sessão', value: 'Ordinária 045/2026', link: '#' },
      ]),
      tags: 'câmara,orçamento,2026,prefeitura',
      categorySlug: 'politica',
      featured: true,
      breaking: true,
    },
    {
      slug: 'equipe-local-vence-classico-regional',
      title: 'a cidade Futebol Clube vence clássico regional por 3 a 1',
      subtitle: 'Time da casa se consolida como líder do campeonato regional',
      excerpt: 'Com gols de Lucas, Pedro e Júnior, o AGFC derrotou o rival e assumiu a ponta do campeonato.',
      content: `## Vitória emocionante

Em um jogo eletrizante no estádio municipal, o **a cidade Futebol Clube** venceu o rival **Rondonópolis EC** por 3 a 1, assumindo a liderança isolada do Campeonato Regional.

### Os gols da partida

1. **12'** - Lucas (AGFC) - chute de fora da área
2. **34'** - Pedro (AGFC) - contra-ataque letal

O técnico Sidnei elogiou a entrega do elenco:

> "O time mostrou personalidade. Sabíamos que seria difícil, mas os jogadores executaram o que treinamos durante a semana."

A próxima partida será no domingo, contra o Primavera MT, em pleno Estádio Municipal Zeca Lopes.`,
      coverImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=600&fit=crop',
      gallery: JSON.stringify([
        'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&h=600&fit=crop',
      ]),
      videos: JSON.stringify([
        { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', type: 'youtube', caption: 'Melhores momentos' }
      ]),
      customFields: JSON.stringify([
        { label: 'Estádio', value: 'Zeca Lopes', link: '#' },
        { label: 'Público', value: '3.452 pagantes', link: '#' },
        { label: 'Arbitragem', value: 'Anderson Daronco (FIFA)', link: '#' },
      ]),
      tags: 'futebol,agfc,campeonato regional,classico',
      categorySlug: 'esportes',
      featured: true,
    },
    {
      slug: 'soja-bate-recorde-de-exportacao',
      title: 'Soja bate recorde de exportação no trimestre em a cidade',
      subtitle: 'Crescimento de 23% em relação ao mesmo período do ano anterior',
      excerpt: 'Produtores rurais celebram resultado que movimenta a economia do município.',
      content: `## Recorde histórico

O agronegócio de a cidade registrou no primeiro trimestre de 2026 um **recorde histórico de exportação de soja**, com crescimento de **23%** em relação ao mesmo período do ano anterior.

### Números

- Volume exportado: **185 mil toneladas**
- Receita: **US$ 78 milhões**
- Principais destinos: China, Holanda e Japão

> "Estamos colhendo os frutos de anos de investimento em tecnologia e produtividade", comemora o presidente do Sindicato Rural.

O setor emprega diretamente mais de **1.500 trabalhadores** no município e movimenta toda a cadeia de comércio e serviços.`,
      coverImage: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200&h=600&fit=crop',
      tags: 'soja,agronegocio,exportacao,economia',
      categorySlug: 'agronegocio',
      featured: false,
    },
    {
      slug: 'festival-cultural-movimenta-cidade',
      title: 'Festival Cultural movimenta cidade com três dias de apresentações',
      subtitle: 'Mais de 30 atrações entre música, dança e teatro',
      excerpt: 'Evento traz artistas locais e nacionais em praça pública gratuita.',
      content: `## Três dias de cultura

A Praça Central de a cidade recebe entre os dias 20 e 22 de junho o **Festival Cultural de Inverno**, com mais de 30 atrações confirmadas.

### Programação em destaque

- **Sexta (20)** - Abertura com Banda Municipal (19h)
- **Sábado (21)** - Teatro infantil (16h) e show regional (21h)
- **Domingo (22)** - Dança folclórica (17h) e encerramento (20h)

> "É uma oportunidade de valorizar nossos artistas locais e trazer cultura de qualidade para a população", diz a secretária de Cultura.

A entrada é **gratuita**. Haverá praça de alimentação e feira de artesanato.`,
      coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=600&fit=crop',
      tags: 'cultura,festival,musica,teatro',
      categorySlug: 'cultura',
      featured: false,
    },
    {
      slug: 'policia-prende-suspeito-de-roubo',
      title: 'Polícia Civil prende suspeito de série de roubos no centro',
      subtitle: 'Indivíduo foi localizado após investigação de 30 dias',
      excerpt: 'Suspeito confessou participação em pelo menos 7 roubos a comércios.',
      content: `## Prisão em flagrante

A Polícia Civil de a cidade prendeu nesta quarta-feira um homem de 32 anos suspeito de participar de **7 roubos a comércios** no centro da cidade.

### Detalhes da operação

- Investigações duraram **30 dias**
- Foram ouvidas **12 testemunhas**
- Material de segurança ajudou a identificar suspeito

> "Agradeço à população que colaborou com informações. A detecência depende dessa parceria", afirmou o delegado responsável.

O suspeito foi encaminhado ao sistema prisional de Rondonópolis.`,
      coverImage: 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&h=600&fit=crop',
      tags: 'policia,seguranca,roubo,prisao',
      categorySlug: 'policia',
      featured: false,
      breaking: true,
    },
    {
      slug: 'nova-unidade-saude-entrada',
      title: 'Nova Unidade Básica de Saúde é inaugurada no bairro Primavera',
      subtitle: 'Equipamento atende 12 mil moradores da região',
      excerpt: 'UBS conta com equipe completa e funciona das 7h às 19h.',
      content: `## Inauguração

A Prefeitura de a cidade inaugurou na manhã desta segunda-feira a **nova Unidade Básica de Saúde (UBS) do bairro Primavera**, que atenderá cerca de 12 mil moradores da região.

### Estrutura

- **6 consultórios** médicos
- Sala de **vacina** e **curativos**
- Sala de **nebulização**
- Farmácia básica
- Equipe com **2 médicos, 4 enfermeiros e 6 agentes**

> "Esta é uma conquista histórica do bairro. Não vamos mais precisar atravessar a cidade para atendimento", comemorou um morador.

A unidade funciona **das 7h às 19h**, de segunda a sexta-feira.`,
      coverImage: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&h=600&fit=crop',
      tags: 'saude,ubs,inauguracao,bairro',
      categorySlug: 'saude',
      featured: false,
    },
    {
      slug: 'escola-municipal-recebe-premio-nacional',
      title: 'Escola Municipal Monteiro Lobato recebe prêmio nacional de educação',
      subtitle: 'Projeto de leitura foi destaque entre 5 mil escolas inscritas',
      excerpt: 'Alunos e professores comemoram conquista inédita para a rede municipal.',
      content: `## Reconhecimento nacional

A Escola Municipal **Monteiro Lobato**, em a cidade, foi contemplada com o **Prêmio Nacional de Educação 2026** pelo projeto *"Ler para Crescer"*, que estimula a leitura entre alunos dos anos iniciais.

### O projeto

- Atende **320 alunos** do 1º ao 5º ano
- Distribuiu mais de **2.500 livros** em 2025
- Criou **biblioteca viva** com doações da comunidade
- Aumento de **68%** no índice de leitura

> "Este prêmio pertence a cada criança, cada professor e cada família que acreditou no poder da leitura", declarou a diretora da escola.

A premiação inclui R$ 50 mil em recursos pedagógicos e capacitação para o corpo docente.`,
      coverImage: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&h=600&fit=crop',
      tags: 'educacao,premio,escola,leitura',
      categorySlug: 'educacao',
      featured: false,
    },
    {
      slug: 'startup-local-lanca-app-agro',
      title: 'Startup local lança app que conecta produtores rurais a compradores',
      subtitle: 'Plataforma já conta com 500 produtores cadastrados',
      excerpt: 'AgroConecta promete reduzir intermediários e aumentar margem do produtor.',
      content: `## Inovação no agro

Uma startup fundada por jovens alta-garcenses lançou na última semana o aplicativo **AgroConecta**, plataforma que liga produtores rurais diretamente a compradores, sem intermediários.

### Como funciona

1. Produtor cadastra sua **produção** no app
2. Compradores recebem **notificação** de oferta
3. Negociação acontece no próprio aplicativo
4. Pagamento e logística integrados

> "Queremos devolver ao produtor o controle sobre o preço de sua produção", afirma o CEO da startup.

A plataforma já conta com **500 produtores** e **80 compradores** cadastrados, movimentando R$ 1,2 milhão em dois meses de operação.`,
      coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop',
      tags: 'tecnologia,startup,agro,app',
      categorySlug: 'tecnologia',
      featured: false,
    },
  ]

  for (const p of samplePosts) {
    const cat = cats.find(c => c.slug === p.categorySlug)!
    const existing = await db.post.findUnique({ where: { slug: p.slug } })
    if (existing) continue
    await db.post.create({
      data: {
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        excerpt: p.excerpt,
        content: p.content,
        coverImage: p.coverImage,
        gallery: p.gallery,
        videos: p.videos,
        customFields: p.customFields,
        tags: p.tags,
        categoryId: cat.id,
        authorId: admin!.id,
        status: 'PUBLISHED',
        featured: p.featured ?? false,
        breaking: p.breaking ?? false,
        publishedAt: new Date(),
        seoTitle: p.title,
        seoDescription: p.excerpt,
        ogImage: p.coverImage,
        views: Math.floor(Math.random() * 5000) + 200,
      } as any,
    })
  }

  // ---------- ADS ----------
  const ads = [
    {
      title: 'Supermercado Bom Preço - Promoção de Inverno',
      content: '<strong>Promoção de Inverno!</strong> Descontos de até 40% em todo o departamento de alimentos. Válido até 30/06.',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=400&fit=crop',
      linkUrl: '#',
      placement: 'HEADER_BANNER',
      status: 'ACTIVE',
    },
    {
      title: 'Loja do João - Tudo para sua casa',
      content: 'Móveis, eletrodomésticos e muito mais. <strong>10% OFF à vista.</strong>',
      imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop',
      linkUrl: '#',
      placement: 'HOME_SIDEBAR',
      status: 'ACTIVE',
    },
    {
      title: 'Auto Posto Central',
      content: 'Combustível de qualidade com o melhor preço da cidade. Troca de óleo grátis acima de 50L.',
      imageUrl: 'https://images.unsplash.com/photo-1545459720-aac8509eb02c?w=800&h=400&fit=crop',
      linkUrl: '#',
      placement: 'HOME_MIDDLE',
      status: 'ACTIVE',
    },
    {
      title: 'Anuncie Aqui',
      content: 'Seu anúncio pode estar aqui! Entre em contato: (66) 3000-0000',
      imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
      linkUrl: '#',
      placement: 'ARTICLE_SIDEBAR',
      status: 'ACTIVE',
    },
    {
      title: 'Farmácia Saúde Total',
      content: 'Medicamentos com até 30% OFF. Entrega grátis em toda a cidade.',
      linkUrl: '#',
      placement: 'FOOTER_BANNER',
      status: 'ACTIVE',
    },
  ]
  for (const a of ads) {
    const exists = await db.ad.findFirst({ where: { title: a.title } })
    if (exists) continue
    await db.ad.create({
      data: {
        ...a,
        ownerId: admin!.id,
        isFreeAd: false,
        startAt: new Date(),
        endAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    })
  }

  console.log('✅ Seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
