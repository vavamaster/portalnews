import { db } from '../src/lib/db'
import { PLANS, planConfigToDbData } from '../src/lib/plans'

async function main() {
  console.log('🌱 Seeding classifieds...')

  // ---------- PLANS ----------
  for (let i = 0; i < PLANS.length; i++) {
    const p = PLANS[i]
    await db.plan.upsert({
      where: { slug: p.slug },
      update: planConfigToDbData(p),
      create: { ...planConfigToDbData(p), order: i, isActive: true },
    })
  }
  console.log('✅ Plans seeded:', PLANS.length)

  // ---------- CLASSIFIED CATEGORIES ----------
  const categories = [
    { slug: 'imoveis', name: 'Imóveis', icon: 'Home', color: 'blue', description: 'Casas, apartamentos, terrenos, aluguel e venda.' },
    { slug: 'veiculos', name: 'Veículos', icon: 'Car', color: 'red', description: 'Carros, motos, caminhões e acessórios.' },
    { slug: 'empregos', name: 'Empregos', icon: 'Briefcase', color: 'emerald', description: 'Vagas de emprego e currículos.' },
    { slug: 'servicos', name: 'Serviços', icon: 'Wrench', color: 'amber', description: 'Prestadores de serviço, reformas, manutenção.' },
    { slug: 'produtos', name: 'Produtos', icon: 'ShoppingBag', color: 'purple', description: 'Novos e usados, diversos itens.' },
    { slug: 'animais', name: 'Animais', icon: 'PawPrint', color: 'orange', description: 'Pets, adoção, ração, acessórios.' },
    { slug: 'eletronicos', name: 'Eletrônicos', icon: 'Smartphone', color: 'cyan', description: 'Celulares, notebooks, TVs, gadgets.' },
    { slug: 'moveis', name: 'Móveis', icon: 'Sofa', color: 'lime', description: 'Móveis novos e usados para casa e escritório.' },
    { slug: 'beleza', name: 'Beleza & Estética', icon: 'Scissors', color: 'pink', description: 'Salões, barbearias, estética, cosméticos.' },
    { slug: 'saude', name: 'Saúde', icon: 'Stethoscope', color: 'teal', description: 'Clínicas, consultórios, profissionais de saúde.' },
    { slug: 'educacao', name: 'Educação', icon: 'GraduationCap', color: 'indigo', description: 'Cursos, aulas, escolas, faculdades.' },
    { slug: 'eventos', name: 'Eventos', icon: 'PartyPopper', color: 'rose', description: 'Buffet, decoração, fotografia, sonorização.' },
    { slug: 'esportes', name: 'Esportes & Lazer', icon: 'Dumbbell', color: 'green', description: 'Equipamentos, academias, aulas, equipamentos.' },
    { slug: 'agro', name: 'Agro & Campo', icon: 'Tractor', color: 'yellow', description: 'Tratores, implementos, animais, insumos.' },
    { slug: 'construcao', name: 'Construção', icon: 'HardHat', color: 'slate', description: 'Materiais, ferramentas, mão de obra.' },
  ]
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    await db.classifiedCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, order: i } as any,
    })
  }
  console.log('✅ Categories seeded:', categories.length)

  // ---------- SAMPLE LISTINGS ----------
  const admin = await db.user.findUnique({ where: { email: 'admin@portal.com' } })
  if (!admin) {
    console.log('⚠️ Admin not found, skipping listings')
    return
  }
  const cats = await db.classifiedCategory.findMany()
  const plans = await db.plan.findMany()
  const freePlan = plans.find(p => p.slug === 'FREE')!
  const proPlan = plans.find(p => p.slug === 'PROFESSIONAL')!
  const companyPlan = plans.find(p => p.slug === 'COMPANY')!

  // give admin some credits and points
  await db.user.update({
    where: { id: admin.id },
    data: { points: 500, credits: 50 },
  })

  // ensure admin has active free subscription
  const existingSub = await db.subscription.findFirst({
    where: { userId: admin.id, status: 'ACTIVE' },
  })
  if (!existingSub) {
    await db.subscription.create({
      data: {
        userId: admin.id,
        planId: companyPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentProvider: 'NONE',
      },
    })
  }

  const sampleListings = [
    {
      slug: 'casa-3-quartos-centro',
      title: 'Casa 3 quartos no Centro',
      description: 'Casa ampla com 3 quartos, sendo 1 suíte, sala, cozinha, área de serviço, garagem para 2 carros e quintal. Próxima a escolas e mercados. Documentação ok.',
      price: 380000,
      isNegotiable: true,
      categorySlug: 'imoveis',
      planSlug: 'PROFESSIONAL',
      personType: 'PF',
      phone: '(66) 99600-1234',
      whatsapp: '5566996001234',
      email: 'vendas@imoveisag.com',
      address: 'Rua das Flores, 123',
      city: 'Cidade',
      state: 'MT',
      zipCode: '78840-000',
      latitude: -16.9556,
      longitude: -53.5244,
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop',
      ]),
    },
    {
      slug: 'honda-civic-2020',
      title: 'Honda Civic LXR 2020 - 78 mil km - único dono',
      description: 'Honda Civic LXR 2020 automático, 78.000 km, único dono, todas revisões em concessionária. Bancos em couro, teto solar, central multimídia. Financiamento aceito.',
      price: 115000,
      isNegotiable: false,
      categorySlug: 'veiculos',
      planSlug: 'COMPANY',
      personType: 'PJ',
      document: '12.345.678/0001-90',
      businessName: 'Auto Prime Veículos LTDA',
      phone: '(66) 99600-5678',
      whatsapp: '5566996005678',
      email: 'contato@autoprime.com',
      website: 'https://autoprime.com',
      address: 'Av. Brasil, 1500 - Centro',
      city: 'Cidade',
      state: 'MT',
      zipCode: '78840-000',
      latitude: -16.9560,
      longitude: -53.5250,
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&h=600&fit=crop',
      ]),
      logoUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Auto%20Prime&backgroundColor=1d4ed8&textColor=fff',
      services: JSON.stringify([
        { name: 'Civic LXR 2020', price: 115000, description: '78 mil km, automático', photo: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400' },
        { name: 'Corolla XEi 2019', price: 105000, description: '85 mil km, automático', photo: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400' },
        { name: 'HB20 Comfort 2021', price: 65000, description: '40 mil km, manual', photo: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400' },
      ]),
      featured: true,
    },
    {
      slug: 'vaga-vendedor-interno',
      title: 'Vaga: Vendedor Interno - Loja de Móveis',
      description: 'Contratamos vendedor interno para loja de móveis. Experiência em vendas, bom comunicação, disponibilidade para sábado. Comissão + fixo. Vale transporte e alimentação.',
      price: 1800,
      isNegotiable: false,
      categorySlug: 'empregos',
      planSlug: 'COMPANY',
      personType: 'PJ',
      document: '98.765.432/0001-10',
      businessName: 'Móveis Conforto LTDA',
      phone: '(66) 99600-9999',
      whatsapp: '5566996009999',
      email: 'rh@moveisconforto.com',
      address: 'Rua dos Pinheiros, 456',
      city: 'Cidade',
      state: 'MT',
      latitude: -16.9580,
      longitude: -53.5260,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=600&fit=crop']),
      logoUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Móveis%20Conforto&backgroundColor=f59e0b&textColor=fff',
    },
    {
      slug: 'encanador-24h',
      title: 'Encanador 24h - Hidráulica e Caça Vazamentos',
      description: 'Atendo na cidade e região. Hidráulica em geral, caça vazamentos, desentupimento, instalação de caixas acopladas, troca de registros. Orçamento sem compromisso.',
      price: 80,
      isNegotiable: true,
      categorySlug: 'servicos',
      planSlug: 'PROFESSIONAL',
      personType: 'PF',
      phone: '(66) 99655-2424',
      whatsapp: '5566996552424',
      email: 'joao.encanador@email.com',
      address: 'Rua Sete de Setembro, 789',
      city: 'Cidade',
      state: 'MT',
      latitude: -16.9570,
      longitude: -53.5270,
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&h=600&fit=crop',
      ]),
    },
    {
      slug: 'geladeira-brastemp-frost-free',
      title: 'Geladeira Brastemp Frost Free 375L - semi nova',
      description: 'Geladeira Brastemp Frost Free 375L, cor inox, 2 anos de uso, em perfeito estado. Visto a dinheiro. Motivo da venda: mudança.',
      price: 1200,
      isNegotiable: true,
      categorySlug: 'produtos',
      planSlug: 'FREE',
      personType: 'PF',
      city: 'Cidade',
      state: 'MT',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=600&fit=crop']),
    },
    {
      slug: 'filhotes-lhasa-apso',
      title: 'Filhotes Lhasa Apso - vacinados e vermifugados',
      description: 'Filhotes de Lhasa Apso, 60 dias, vacinados e vermifugados. Pais no local. Disponíveis 3 machos e 2 fêmeas. Docilidade e saúde garantidas.',
      price: 1500,
      isNegotiable: false,
      categorySlug: 'animais',
      planSlug: 'PROFESSIONAL',
      personType: 'PF',
      phone: '(66) 99644-7878',
      whatsapp: '5566996447878',
      city: 'Cidade',
      state: 'MT',
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=800&h=600&fit=crop',
      ]),
    },
    {
      slug: 'notebook-dell-inspiron-15',
      title: 'Notebook Dell Inspiron 15 3000 - i5 8GB 256SSD',
      description: 'Notebook Dell Inspiron 15 3000, Intel Core i5 8ª geração, 8GB RAM, SSD 256GB, Windows 11. Bateria em ótimo estado. Acompanha carregador original.',
      price: 2200,
      isNegotiable: true,
      categorySlug: 'eletronicos',
      planSlug: 'FREE',
      personType: 'PF',
      city: 'Cidade',
      state: 'MT',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=600&fit=crop']),
    },
    {
      slug: 'salao-beleza-maria',
      title: 'Salão de Beleza Maria - Cortes, Coloração, Manicure',
      description: 'Salão de beleza completo. Cortes feminino e masculino, coloração, mechas, manicure, pedicure, design de sobrancelhas. Ambiente climatizado. Atendimento com hora marcada.',
      price: 50,
      isNegotiable: false,
      categorySlug: 'beleza',
      planSlug: 'COMPANY',
      personType: 'PJ',
      document: '11.222.333/0001-44',
      businessName: 'Salão Maria Beatriz LTDA ME',
      phone: '(66) 99611-3030',
      whatsapp: '5566996113030',
      email: 'contato@salaoamaria.com',
      address: 'Av. Mato Grosso, 234',
      city: 'Cidade',
      state: 'MT',
      latitude: -16.9545,
      longitude: -53.5235,
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1522335789203-aaa585f0cc3c?w=800&h=600&fit=crop',
      ]),
      logoUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Salão%20Maria&backgroundColor=ec4899&textColor=fff',
      services: JSON.stringify([
        { name: 'Corte Feminino', price: 50, description: 'Lavagem + corte + escova', photo: '' },
        { name: 'Coloração', price: 120, description: 'Tintura completa', photo: '' },
        { name: 'Manicure', price: 25, description: 'Mãos completas', photo: '' },
        { name: 'Sobrancelhas', price: 20, description: 'Design + henna', photo: '' },
      ]),
      featured: true,
    },
  ]

  for (const l of sampleListings) {
    const cat = cats.find(c => c.slug === l.categorySlug)!
    const plan = plans.find(p => p.slug === l.planSlug)!
    const existing = await db.classifiedListing.findUnique({ where: { slug: l.slug } })
    if (existing) continue
    const { slug: listingSlug, categorySlug, planSlug, featured, ...data } = l
    await db.classifiedListing.create({
      data: {
        slug: listingSlug,
        ...data,
        categoryId: cat.id,
        ownerId: admin.id,
        planId: plan.id,
        status: 'ACTIVE',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        featured: featured || false,
        featuredUntil: featured ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : null,
      } as any,
    })
  }
  console.log('✅ Sample listings seeded:', sampleListings.length)

  // ---------- SEO additions for classifieds ----------
  await db.seoSetting.upsert({
    where: { key: 'classifieds_max_distance_km' },
    update: { value: '50' },
    create: { key: 'classifieds_max_distance_km', value: '50' },
  })

  console.log('✅ Classifieds seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
