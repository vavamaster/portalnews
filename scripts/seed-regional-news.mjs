#!/usr/bin/env node

import { copyFile, mkdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const db = new PrismaClient()
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const databasePath = path.join(rootDir, 'db', 'custom.db')
const backupDir = path.join(rootDir, 'db', 'backups')
const coverDir = path.join(rootDir, 'public', 'uploads', 'regional-news')
const targetPerCategory = Number(process.argv.find(argument => argument.startsWith('--target='))?.split('=')[1] || 10)
const applyChanges = process.argv.includes('--apply')
const refreshCovers = process.argv.includes('--refresh-covers')

const PALETTES = {
  politica: ['#172554', '#2563eb', '#60a5fa'],
  policia: ['#450a0a', '#dc2626', '#fca5a5'],
  esportes: ['#052e16', '#16a34a', '#86efac'],
  economia: ['#451a03', '#d97706', '#fcd34d'],
  cultura: ['#3b0764', '#9333ea', '#d8b4fe'],
  educacao: ['#082f49', '#0284c7', '#7dd3fc'],
  saude: ['#042f2e', '#0d9488', '#99f6e4'],
  agronegocio: ['#1a2e05', '#65a30d', '#bef264'],
  tecnologia: ['#1e1b4b', '#4f46e5', '#a5b4fc'],
  geral: ['#18181b', '#52525b', '#d4d4d8'],
}

const CATEGORY_CONTEXT = {
  politica: 'Decisões administrativas, leis, orçamento e planejamento territorial afetam serviços públicos, investimentos e prioridades locais.',
  policia: 'Segurança pública no Centro-Oeste combina prevenção, investigação, proteção social e integração entre municípios, estados e forças especializadas.',
  esportes: 'O esporte regional movimenta escolas, clubes, projetos sociais, turismo e saúde, além de revelar talentos em cidades de diferentes portes.',
  economia: 'Mato Grosso e Goiás articulam agropecuária, indústria, comércio, logística, serviços e pequenos negócios em economias regionais diversificadas.',
  cultura: 'A diversidade cultural do Centro-Oeste reúne patrimônios materiais, festas populares, música, gastronomia, artes visuais e saberes tradicionais.',
  educacao: 'Distâncias, diversidade territorial, inclusão, formação profissional e conectividade são temas centrais para a educação em Mato Grosso e Goiás.',
  saude: 'A organização regional do SUS precisa conectar atenção básica, prevenção, vigilância, hospitais e atendimento especializado em grandes distâncias.',
  agronegocio: 'Produção de grãos, pecuária, agricultura familiar, tecnologia e conservação ambiental formam uma cadeia decisiva para os dois estados.',
  tecnologia: 'Conectividade, serviços digitais, inovação aplicada ao campo, segurança da informação e formação tecnológica transformam cidades e empresas.',
  geral: 'Mobilidade, meio ambiente, turismo, crescimento urbano e serviços públicos ajudam a explicar o cotidiano e as transformações dos dois estados.',
}

const PUBLIC_INTEREST = {
  politica: 'Para o cidadão, o ponto central é saber onde consultar atos oficiais, comparar o que foi planejado com o que foi executado e participar dos canais públicos de decisão.',
  policia: 'A orientação prática é registrar ocorrências pelos canais oficiais, preservar provas, evitar exposição indevida e procurar atendimento especializado quando necessário.',
  esportes: 'A agenda pública inclui acesso a espaços esportivos, calendário de competições, formação de base, inclusão e manutenção adequada das estruturas.',
  economia: 'Moradores e empreendedores podem acompanhar indicadores oficiais, oportunidades de qualificação, crédito, infraestrutura e mudanças nas cadeias locais.',
  cultura: 'Preservar memória e ampliar acesso exige inventário, formação de público, apoio aos produtores culturais e circulação de atividades pelo interior.',
  educacao: 'Famílias devem acompanhar matrícula, transporte, alimentação, calendário, indicadores de aprendizagem e canais de atendimento das redes de ensino.',
  saude: 'Informação confiável, vacinação, prevenção e conhecimento da porta de entrada correta no SUS reduzem riscos e melhoram o uso da rede.',
  agronegocio: 'Produtores precisam combinar planejamento, assistência técnica, gestão de risco, regularidade ambiental e acesso a dados de mercado.',
  tecnologia: 'A transformação digital precisa vir acompanhada de acessibilidade, proteção de dados, capacitação e alternativas para quem ainda tem conexão limitada.',
  geral: 'O acompanhamento de alertas, serviços oficiais e decisões municipais ajuda moradores a planejar deslocamentos e cobrar respostas mais eficientes.',
}

const STATE_REFERENCES = {
  MT: {
    name: 'Mato Grosso',
    portal: 'https://www.mt.gov.br/',
    ibge: 'https://www.ibge.gov.br/cidades-e-estados/mt.html',
    topics: {
      politica: 'https://www.transparencia.mt.gov.br/',
      policia: 'https://www.sesp.mt.gov.br/',
      esportes: 'https://www.secel.mt.gov.br/',
      economia: 'https://www.seplag.mt.gov.br/',
      cultura: 'https://www.secel.mt.gov.br/',
      educacao: 'https://www.seduc.mt.gov.br/',
      saude: 'https://www.saude.mt.gov.br/',
      agronegocio: 'https://www.seaf.mt.gov.br/',
      tecnologia: 'https://www.seciteci.mt.gov.br/',
      geral: 'https://www.mt.gov.br/',
    },
  },
  GO: {
    name: 'Goiás',
    portal: 'https://goias.gov.br/',
    ibge: 'https://www.ibge.gov.br/cidades-e-estados/go.html',
    topics: {
      politica: 'https://www.transparencia.go.gov.br/',
      policia: 'https://goias.gov.br/seguranca/',
      esportes: 'https://goias.gov.br/esporte/',
      economia: 'https://goias.gov.br/imb/',
      cultura: 'https://goias.gov.br/cultura/',
      educacao: 'https://goias.gov.br/educacao/',
      saude: 'https://goias.gov.br/saude/',
      agronegocio: 'https://goias.gov.br/agricultura/',
      tecnologia: 'https://goias.gov.br/inovacao/',
      geral: 'https://goias.gov.br/',
    },
  },
}

const TOPICS = {
  politica: [
    ['MT', 'Mato Grosso', 'Orçamento público de Mato Grosso: como acompanhar receitas e despesas', 'transparência orçamentária e acompanhamento da execução de políticas públicas'],
    ['GO', 'Goiás', 'Transparência em Goiás: caminhos para fiscalizar contratos e obras', 'acesso a contratos, licitações, obras e dados de execução financeira'],
    ['MT', 'Cuiabá e Várzea Grande', 'Planos diretores de Cuiabá e Várzea Grande: o impacto na vida urbana', 'planejamento urbano, uso do solo, mobilidade e expansão metropolitana'],
    ['GO', 'Entorno do Distrito Federal', 'Governança no Entorno do DF: desafios compartilhados entre municípios goianos', 'cooperação regional em transporte, saúde, educação e infraestrutura'],
    ['MT', 'Norte de Mato Grosso', 'Como consórcios municipais podem fortalecer serviços no norte de Mato Grosso', 'cooperação entre prefeituras para serviços de alcance regional'],
    ['GO', 'Anápolis', 'Participação popular em Anápolis: como acompanhar audiências e projetos', 'canais de participação social e acompanhamento do Legislativo municipal'],
    ['MT', 'Mato Grosso', 'Políticas públicas para povos indígenas exigem diálogo territorial em Mato Grosso', 'participação comunitária e coordenação de políticas em territórios indígenas'],
    ['GO', 'Sudoeste goiano', 'Sudoeste goiano: como prioridades locais chegam ao planejamento estadual', 'articulação entre municípios produtivos e políticas estaduais'],
    ['MT', 'Cidades do interior de Mato Grosso', 'Planejamento de longo prazo ganha importância nas cidades do interior de Mato Grosso', 'continuidade administrativa, metas públicas e desenvolvimento territorial'],
    ['GO', 'Cidade de Goiás', 'Patrimônio e gestão pública na cidade de Goiás: decisões que afetam a preservação', 'gestão urbana associada à proteção do patrimônio histórico'],
  ],
  policia: [
    ['MT', 'Corredor da BR-163 em Mato Grosso', 'Segurança na BR-163: integração é essencial no combate ao roubo de cargas', 'prevenção e cooperação institucional nos corredores logísticos'],
    ['GO', 'Corredor da BR-153 em Goiás', 'BR-153 em Goiás: cuidados e canais de atendimento para quem viaja', 'segurança rodoviária, comunicação de ocorrências e planejamento de viagem'],
    ['MT', 'Mato Grosso', 'Golpes digitais em Mato Grosso: como preservar provas e registrar ocorrência', 'prevenção a fraudes digitais e orientação para vítimas'],
    ['GO', 'Goiás', 'Rede de proteção à mulher em Goiás: onde buscar atendimento', 'canais públicos de acolhimento, proteção e denúncia'],
    ['MT', 'Zona rural de Mato Grosso', 'Segurança rural em Mato Grosso depende de informação e cooperação', 'prevenção patrimonial e comunicação entre propriedades e autoridades'],
    ['GO', 'Região metropolitana de Goiânia', 'Prevenção comunitária pode reduzir riscos no cotidiano da Grande Goiânia', 'medidas de prevenção em bairros, comércios e espaços públicos'],
    ['MT', 'Cuiabá', 'Delegacia virtual em Mato Grosso: quando o registro online pode ser utilizado', 'uso responsável dos canais digitais de registro de ocorrência'],
    ['GO', 'Goiás', 'Como agir diante de fraudes bancárias e golpes por mensagem em Goiás', 'proteção de contas, preservação de evidências e busca de atendimento'],
    ['MT', 'Fronteira oeste de Mato Grosso', 'Fronteira oeste de Mato Grosso exige atuação integrada contra crimes', 'cooperação entre órgãos em áreas de fronteira e longas distâncias'],
    ['GO', 'Interior de Goiás', 'Segurança em eventos no interior de Goiás começa no planejamento', 'prevenção, rotas de emergência e organização de grandes públicos'],
  ],
  esportes: [
    ['MT', 'Mato Grosso', 'Futebol mato-grossense: formação de base sustenta o futuro dos clubes', 'categorias de base, calendário, estrutura e desenvolvimento de atletas'],
    ['GO', 'Goiás', 'Futebol goiano além da capital: clubes do interior fortalecem o calendário', 'participação de equipes do interior e organização das competições'],
    ['MT', 'Cuiabá', 'Corrida de rua em Cuiabá exige atenção ao calor, hidratação e percurso', 'prática esportiva segura em clima quente'],
    ['GO', 'Goiânia', 'Parques de Goiânia ampliam opções para caminhada e atividade física', 'uso responsável de áreas públicas para esporte e lazer'],
    ['MT', 'Mato Grosso', 'Jogos escolares ajudam a revelar talentos em diferentes regiões de Mato Grosso', 'esporte educacional, inclusão e formação de jovens'],
    ['GO', 'Goiás', 'Esporte paralímpico em Goiás depende de acesso e continuidade', 'acessibilidade, formação esportiva e apoio a atletas'],
    ['MT', 'Chapada dos Guimarães', 'Esportes de natureza na Chapada pedem preparação e respeito ambiental', 'segurança e conservação em atividades ao ar livre'],
    ['GO', 'Pirenópolis e região', 'Ciclismo em Pirenópolis combina turismo, esporte e cuidado nas trilhas', 'prática de ciclismo com planejamento e responsabilidade ambiental'],
    ['MT', 'Comunidades indígenas de Mato Grosso', 'Jogos indígenas preservam práticas corporais e identidade em Mato Grosso', 'valorização cultural por meio do esporte comunitário'],
    ['GO', 'Interior de Goiás', 'Futebol feminino avança quando cidades mantêm formação e calendário', 'participação feminina, base esportiva e competições regulares'],
  ],
  economia: [
    ['MT', 'Mato Grosso', 'Logística em Mato Grosso influencia custos do campo ao comércio', 'transporte, armazenagem e integração de cadeias produtivas'],
    ['GO', 'Anápolis', 'Anápolis conecta indústria, logística e serviços no centro do país', 'papel regional da indústria e dos serviços logísticos'],
    ['MT', 'Cuiabá', 'Setor de serviços sustenta oportunidades e pequenos negócios em Cuiabá', 'empreendedorismo urbano, qualificação e economia de serviços'],
    ['GO', 'Goiânia', 'Economia criativa amplia possibilidades para empreendedores de Goiânia', 'negócios ligados à cultura, design, comunicação e eventos'],
    ['MT', 'Interior de Mato Grosso', 'Pequenos negócios do interior de Mato Grosso enfrentam o desafio da escala', 'gestão, mercado digital e acesso a fornecedores'],
    ['GO', 'Sudoeste goiano', 'Agroindústria diversifica a economia do sudoeste goiano', 'integração entre produção rural, processamento e distribuição'],
    ['MT', 'Região de Rondonópolis', 'Rondonópolis ocupa posição estratégica nas rotas econômicas de Mato Grosso', 'conexão entre produção, transporte, comércio e serviços'],
    ['GO', 'Caldas Novas e região', 'Turismo regional movimenta serviços em Caldas Novas e cidades vizinhas', 'hotelaria, alimentação, comércio e planejamento turístico'],
    ['MT', 'Mato Grosso', 'Qualificação profissional acompanha novas demandas da economia mato-grossense', 'formação técnica ligada às transformações produtivas'],
    ['GO', 'Goiás', 'Indicadores oficiais ajudam empresas a entender a economia de Goiás', 'uso de dados públicos em decisões de investimento e planejamento'],
  ],
  cultura: [
    ['MT', 'Cuiabá e região', 'Siriri e cururu mantêm viva a identidade cultural de Mato Grosso', 'preservação e transmissão de manifestações tradicionais'],
    ['GO', 'Pirenópolis e cidades do circuito', 'Cavalhadas de Goiás unem memória, turismo e participação comunitária', 'continuidade de festas tradicionais e seus impactos locais'],
    ['MT', 'Mato Grosso', 'Viola de cocho representa saberes e memória das comunidades mato-grossenses', 'proteção de patrimônio imaterial e formação de novos mestres'],
    ['GO', 'Goiânia', 'Art Déco de Goiânia exige preservação e uso responsável do centro histórico', 'conservação arquitetônica e valorização urbana'],
    ['MT', 'Territórios indígenas de Mato Grosso', 'Arte indígena de Mato Grosso comunica território, memória e resistência', 'valorização de autoria, saberes e circulação responsável'],
    ['GO', 'Cidade de Goiás', 'Cidade de Goiás transforma patrimônio em experiência cultural permanente', 'relação entre patrimônio, moradores, visitantes e economia cultural'],
    ['MT', 'Pantanal mato-grossense', 'Cultura pantaneira reúne música, culinária e modos de vida', 'registro e valorização de saberes ligados ao Pantanal'],
    ['GO', 'Goiás', 'Pequi atravessa gastronomia, memória afetiva e identidade goiana', 'cultura alimentar e valorização de produtos regionais'],
    ['MT', 'Interior de Mato Grosso', 'Festivais no interior ajudam artistas de Mato Grosso a circular', 'descentralização da programação e formação de público'],
    ['GO', 'Trindade', 'Turismo religioso em Trindade mobiliza tradição e serviços locais', 'organização cultural e acolhimento em grandes celebrações'],
  ],
  educacao: [
    ['MT', 'Zona rural de Mato Grosso', 'Transporte escolar rural é decisivo para estudantes de Mato Grosso', 'regularidade, segurança e longas distâncias no acesso à escola'],
    ['GO', 'Norte de Goiás', 'Conectividade escolar ainda exige atenção em comunidades do norte goiano', 'acesso à internet, equipamentos e uso pedagógico da tecnologia'],
    ['MT', 'Territórios indígenas de Mato Grosso', 'Educação escolar indígena precisa respeitar línguas e territórios', 'formação específica e valorização de projetos pedagógicos comunitários'],
    ['GO', 'Goiás', 'Educação profissional aproxima jovens goianos do mundo do trabalho', 'formação técnica conectada às vocações regionais'],
    ['MT', 'Mato Grosso', 'Alfabetização na idade certa depende de acompanhamento contínuo', 'avaliação, apoio pedagógico e participação das famílias'],
    ['GO', 'Interior de Goiás', 'Universidades e institutos ampliam oportunidades no interior de Goiás', 'interiorização do ensino superior e desenvolvimento regional'],
    ['MT', 'Mato Grosso', 'Alimentação escolar conecta educação e agricultura familiar em Mato Grosso', 'qualidade da merenda e compras da produção local'],
    ['GO', 'Goiás', 'Feiras de ciência estimulam investigação e criatividade nas escolas goianas', 'aprendizagem baseada em projetos e iniciação científica'],
    ['MT', 'Mato Grosso', 'Formação de professores acompanha mudanças na sala de aula', 'desenvolvimento profissional e atualização de práticas pedagógicas'],
    ['GO', 'Goiás', 'Inclusão escolar exige estrutura, formação e acompanhamento individual', 'acessibilidade e atendimento educacional inclusivo'],
  ],
  saude: [
    ['MT', 'Mato Grosso', 'Atenção básica organiza a porta de entrada do SUS em Mato Grosso', 'prevenção, acompanhamento e encaminhamento na rede pública'],
    ['GO', 'Goiás', 'Regionalização da saúde aproxima atendimento especializado do interior goiano', 'organização de referências entre municípios e unidades'],
    ['MT', 'Mato Grosso', 'Telessaúde pode reduzir distâncias no atendimento em Mato Grosso', 'apoio remoto a equipes e acesso responsável a especialistas'],
    ['GO', 'Goiás', 'Combate ao mosquito exige ação contínua dentro e fora de casa', 'prevenção de arboviroses e participação comunitária'],
    ['MT', 'Pantanal e áreas de fumaça', 'Fumaça e baixa umidade exigem cuidados de saúde em Mato Grosso', 'prevenção de problemas respiratórios em períodos críticos'],
    ['GO', 'Goiás', 'Saúde mental na atenção primária amplia possibilidades de cuidado', 'acolhimento, acompanhamento e encaminhamento adequado'],
    ['MT', 'Territórios indígenas de Mato Grosso', 'Saúde indígena em Mato Grosso combina território e cuidado intercultural', 'atenção diferenciada e articulação entre equipes'],
    ['GO', 'Goiás', 'Segurança do paciente depende de protocolos e comunicação clara', 'prevenção de riscos em serviços de saúde'],
    ['MT', 'Rodovias de Mato Grosso', 'Acidentes rodoviários pressionam a rede de urgência em Mato Grosso', 'prevenção, resposta rápida e integração do atendimento'],
    ['GO', 'Goiás', 'Vacinação continua essencial em todas as fases da vida', 'atualização da caderneta e orientação em unidades de saúde'],
  ],
  agronegocio: [
    ['MT', 'Mato Grosso', 'Rotação de culturas fortalece o planejamento agrícola em Mato Grosso', 'manejo de solo, diversificação e gestão produtiva'],
    ['GO', 'Goiás', 'Pecuária de Goiás avança com gestão, sanidade e rastreabilidade', 'controle sanitário e organização das informações do rebanho'],
    ['MT', 'Oeste de Mato Grosso', 'Algodão movimenta tecnologia e logística no oeste de Mato Grosso', 'cadeia produtiva, qualidade e transporte da produção'],
    ['GO', 'Goiás', 'Produção de leite em Goiás depende de eficiência dentro e fora da porteira', 'gestão, qualidade, assistência técnica e mercado'],
    ['MT', 'Mato Grosso', 'Armazenagem é peça central para reduzir perdas na produção de grãos', 'capacidade de estocagem e planejamento de comercialização'],
    ['GO', 'Agricultura familiar goiana', 'Agricultura familiar amplia diversidade e abastecimento em Goiás', 'produção local, assistência técnica e acesso a mercados'],
    ['MT', 'Mato Grosso', 'Bioinsumos ganham espaço no manejo das lavouras mato-grossenses', 'uso técnico de soluções biológicas e acompanhamento agronômico'],
    ['GO', 'Goiás', 'Irrigação exige planejamento hídrico e eficiência no campo goiano', 'uso racional da água e gestão de sistemas produtivos'],
    ['MT', 'Mato Grosso', 'Risco climático reforça importância de dados e planejamento da safra', 'monitoramento, seguro e decisões baseadas em informação'],
    ['GO', 'Sudoeste de Goiás', 'Agroindústria agrega valor à produção do sudoeste de Goiás', 'processamento, empregos e integração da cadeia regional'],
  ],
  tecnologia: [
    ['MT', 'Mato Grosso', 'Agtechs desenvolvem soluções para desafios do campo em Mato Grosso', 'tecnologia aplicada a gestão, produtividade e rastreabilidade'],
    ['GO', 'Goiás', 'Ecossistema de startups de Goiás se espalha por diferentes setores', 'empreendedorismo inovador em agro, saúde, educação e serviços'],
    ['MT', 'Mato Grosso', 'Serviços públicos digitais precisam funcionar também para o interior', 'acessibilidade, conectividade e atendimento multicanal'],
    ['GO', 'Goiás', 'Governo digital amplia conveniência, mas exige segurança e inclusão', 'proteção de dados e acesso responsável a serviços online'],
    ['MT', 'Propriedades rurais de Mato Grosso', 'Drones no campo exigem capacitação, regras e interpretação de dados', 'uso responsável de imagens e sensores na produção rural'],
    ['GO', 'Goiás', 'Inteligência artificial chega às salas de aula e pede uso crítico', 'formação de professores, ética e aprendizagem'],
    ['MT', 'Mato Grosso', 'Segurança digital deve fazer parte da rotina de empresas e prefeituras', 'prevenção de incidentes, cópias de segurança e resposta a ataques'],
    ['GO', 'Goiás', 'Healthtechs conectam inovação e necessidades da saúde regional', 'tecnologia aplicada a gestão e cuidado em saúde'],
    ['MT', 'Mato Grosso', 'Dados abertos podem melhorar controle social e novos serviços', 'publicação de dados com qualidade, contexto e proteção de informações'],
    ['GO', 'Anápolis e Goiânia', 'Tecnologia otimiza rotas entre polos logísticos de Goiás', 'dados, rastreamento e eficiência no transporte'],
  ],
  geral: [
    ['MT', 'Mato Grosso', 'Cerrado, Amazônia e Pantanal tornam Mato Grosso ambientalmente diverso', 'convivência entre biomas, cidades e atividades econômicas'],
    ['GO', 'Goiás', 'Cerrado goiano influencia água, produção e qualidade de vida', 'conservação do bioma e planejamento territorial'],
    ['MT', 'Rodovias de Mato Grosso', 'Viagens por Mato Grosso exigem planejamento de distância e abastecimento', 'organização de rotas em um estado de grande extensão'],
    ['GO', 'Rodovias de Goiás', 'Quem cruza Goiás deve acompanhar condições das rodovias e do clima', 'informação de viagem e prevenção de riscos'],
    ['MT', 'Chapada dos Guimarães e Pantanal', 'Turismo de natureza em Mato Grosso pede visitação responsável', 'segurança, respeito às comunidades e conservação'],
    ['GO', 'Chapada dos Veadeiros e Terra Ronca', 'Destinos naturais de Goiás exigem cuidado e planejamento do visitante', 'turismo responsável e proteção ambiental'],
    ['MT', 'Cuiabá e cidades médias', 'Crescimento urbano muda mobilidade e serviços nas cidades mato-grossenses', 'expansão urbana, deslocamentos e infraestrutura'],
    ['GO', 'Goiânia e Entorno do DF', 'Expansão metropolitana desafia transporte e serviços em Goiás', 'integração urbana em áreas de rápido crescimento'],
    ['MT', 'Mato Grosso', 'Prevenção aos incêndios depende de alerta e responsabilidade coletiva', 'redução de riscos e comunicação em períodos secos'],
    ['GO', 'Goiás', 'Água e uso do solo estão ligados ao futuro das cidades goianas', 'proteção de nascentes, abastecimento e planejamento'],
  ],
}

function stripMarkup(value = '') {
  return value.replace(/<[^>]*>/g, '').replace(/[#*_>`-]/g, '').trim()
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hashValue(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function articleSlug(categorySlug, topic) {
  return `regional-${topic[0].toLowerCase()}-${categorySlug}-${slugify(topic[2])}`
}

function buildArticle(category, topic, sequence) {
  const [stateCode, location, title, subject] = topic
  const state = STATE_REFERENCES[stateCode]
  const sourceUrl = state.topics[category.slug]
  const slug = articleSlug(category.slug, topic)
  const coverImage = `/uploads/regional-news/${slug}-visual.webp`
  const subtitle = `${location} integra uma agenda regional sobre ${subject}.`
  const excerpt = `Reportagem de contexto explica ${subject} e mostra quais informações moradores de ${location} devem acompanhar.`
  const content = `## Contexto regional

${location} faz parte de uma região em que **${subject}** tem impacto direto no cotidiano. ${CATEGORY_CONTEXT[category.slug]}

Esta reportagem apresenta contexto e orientação de serviço. O texto não anuncia uma ocorrência específica nem reproduz declarações não verificadas; seu objetivo é ajudar o leitor a entender o tema e localizar fontes oficiais.

## Por que o assunto merece atenção

As realidades de ${state.name} variam entre capital, cidades médias, pequenos municípios e áreas rurais. Por isso, uma mesma política ou transformação pode produzir resultados diferentes conforme distância, infraestrutura disponível, capacidade de atendimento e participação da comunidade.

No caso de ${subject}, a análise precisa considerar planejamento, continuidade das ações, acesso à informação e indicadores públicos. Comparar dados ao longo do tempo é mais útil do que observar números isolados.

## O que moradores podem acompanhar

- Publicações, alertas e calendários divulgados pelos órgãos responsáveis;
- Dados estaduais e municipais apresentados com fonte e período de referência;
- Canais de atendimento, participação social e prestação de contas;
- Diferenças entre anúncio, ação iniciada e resultado efetivamente entregue;
- Orientações específicas para ${location} e municípios próximos.

## Impacto para a população

${PUBLIC_INTEREST[category.slug]}

Também é importante confirmar informações antes de compartilhar. Conteúdos sem data, município, órgão responsável ou link para a fonte podem estar incompletos ou fora de contexto.

## Fontes para consulta

- [Portal oficial de ${state.name}](${state.portal})
- [Órgão estadual relacionado ao tema](${sourceUrl})
- [Panorama do ${state.name} no IBGE](${state.ibge})

*Conteúdo regional produzido para organizar informações de interesse público sobre Mato Grosso e Goiás. Atualizações devem considerar os comunicados mais recentes das instituições responsáveis.*`

  return {
    slug,
    title,
    subtitle,
    excerpt,
    content,
    coverImage,
    tags: [
      category.slug,
      state.name.toLowerCase(),
      stateCode.toLowerCase(),
      slugify(location).replaceAll('-', ' '),
      'centro-oeste',
      'reportagem regional',
    ].join(','),
    seoTitle: title.slice(0, 70),
    seoDescription: excerpt.slice(0, 160),
    ogImage: coverImage,
    customFields: JSON.stringify([
      { label: 'Abrangência', value: location, link: state.portal },
      { label: 'Fonte temática', value: `Órgão oficial de ${state.name}`, link: sourceUrl },
      { label: 'Dados territoriais', value: 'IBGE', link: state.ibge },
    ]),
    featured: sequence === 0,
    stateCode,
    location,
  }
}

async function coverExists(relativeUrl) {
  try {
    await stat(path.join(rootDir, 'public', relativeUrl.replace(/^\//, '')))
    return true
  } catch {
    return false
  }
}

async function createCover(article, category, sequence) {
  const palette = PALETTES[category.slug] || PALETTES.geral
  const seed = hashValue(`${article.slug}-${sequence}`)
  const accentX = 820 + (seed % 220)
  const accentY = 95 + ((seed >>> 4) % 165)
  const ringRadius = 150 + ((seed >>> 8) % 95)
  const diagonalOffset = (seed >>> 12) % 190
  const dotOffset = (seed >>> 16) % 34
  const contourPaths = Array.from({ length: 7 }, (_, index) => {
    const y = 118 + index * 62 + ((seed >>> (index + 2)) % 24)
    const bend = 34 + ((seed >>> (index + 7)) % 70)
    return `<path d="M690 ${y} C790 ${y - bend} 900 ${y + bend} 1200 ${y - 18}" fill="none" stroke="#ffffff" stroke-width="2" opacity="${0.07 + index * 0.012}"/>`
  }).join('')
  const svg = `
    <svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="62%" stop-color="${palette[1]}"/>
          <stop offset="100%" stop-color="${palette[2]}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <pattern id="dots" x="${dotOffset}" y="${dotOffset}" width="36" height="36" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="2" fill="#ffffff" opacity="0.13"/>
        </pattern>
        <linearGradient id="quiet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.34"/>
          <stop offset="72%" stop-color="#000000" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)"/>
      <path d="M${640 + diagonalOffset} -80 L1260 130 L1260 420 L${500 + diagonalOffset} 130 Z" fill="#ffffff" opacity="0.055"/>
      <circle cx="${accentX}" cy="${accentY}" r="${ringRadius + 90}" fill="url(#glow)"/>
      <circle cx="${accentX}" cy="${accentY}" r="${ringRadius}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.13"/>
      <circle cx="${accentX}" cy="${accentY}" r="${Math.round(ringRadius * 0.62)}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.11"/>
      <rect x="610" width="590" height="675" fill="url(#dots)"/>
      ${contourPaths}
      <path d="M0 525 C250 455 420 610 700 545 C925 492 1050 440 1200 476 L1200 675 L0 675 Z" fill="#000000" opacity="0.13"/>
      <path d="M0 0 H760 C655 180 690 390 565 675 H0 Z" fill="url(#quiet)"/>
      <circle cx="${1050 - (seed % 130)}" cy="${560 - ((seed >>> 5) % 80)}" r="245" fill="#000000" opacity="0.06"/>
    </svg>`

  await mkdir(coverDir, { recursive: true })
  const outputPath = path.join(coverDir, path.basename(article.coverImage))
  await sharp(Buffer.from(svg))
    .resize(1200, 675)
    .webp({ quality: 82, effort: 5 })
    .toFile(outputPath)
}

function buildRegionalCatalog(categories) {
  return categories.flatMap(category => TOPICS[category.slug].map((topic, sequence) => ({
    category,
    article: buildArticle(category, topic, sequence),
    sequence,
  })))
}

async function createDatabaseBackup(label) {
  await mkdir(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `custom-before-${label}-${timestamp}.db`)
  await copyFile(databasePath, backupPath)
  console.log(`\nBackup criado: ${backupPath}`)
}

async function removeOldCover(relativeUrl) {
  if (!relativeUrl?.startsWith('/uploads/regional-news/')) return
  try {
    await unlink(path.join(rootDir, 'public', relativeUrl.replace(/^\//, '')))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function buildPlan() {
  const [categories, posts, author] = await Promise.all([
    db.category.findMany({ where: { parentId: null }, orderBy: { order: 'asc' } }),
    db.post.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        coverImage: true,
        categoryId: true,
        category: { select: { name: true, slug: true } },
      },
    }),
    db.user.findFirst({ where: { role: 'MASTER' }, orderBy: { createdAt: 'asc' } }),
  ])

  if (!author) throw new Error('Nenhum usuário MASTER disponível para assinar as matérias.')
  const unsupportedCategories = categories.filter(category => !TOPICS[category.slug])
  if (unsupportedCategories.length) {
    throw new Error(`Categorias sem pauta regional configurada: ${unsupportedCategories.map(category => category.slug).join(', ')}`)
  }

  const invalidPosts = posts.filter(post => !post.coverImage?.trim() || !stripMarkup(post.content))
  const invalidIds = new Set(invalidPosts.map(post => post.id))
  const existingSlugs = new Set(posts.map(post => post.slug))
  const creations = []

  for (const category of categories) {
    const validCount = posts.filter(post => post.categoryId === category.id && !invalidIds.has(post.id)).length
    const needed = Math.max(0, targetPerCategory - validCount)
    const candidates = TOPICS[category.slug]
      .filter(topic => !existingSlugs.has(articleSlug(category.slug, topic)))
      .slice(0, needed)

    if (candidates.length < needed) {
      throw new Error(`Pautas insuficientes para ${category.name}: necessárias ${needed}, disponíveis ${candidates.length}.`)
    }

    candidates.forEach((topic, index) => {
      creations.push({
        category,
        article: buildArticle(category, topic, index),
      })
    })
  }

  return { author, categories, posts, invalidPosts, creations }
}

async function verifyDatabase() {
  const categories = await db.category.findMany({
    where: { parentId: null },
    orderBy: { order: 'asc' },
    include: {
      posts: {
        select: { id: true, slug: true, content: true, coverImage: true, status: true },
      },
    },
  })
  const missingFiles = []
  const summary = []

  for (const category of categories) {
    const invalid = category.posts.filter(post => !post.coverImage?.trim() || !stripMarkup(post.content))
    for (const post of category.posts) {
      if (post.coverImage?.startsWith('/uploads/regional-news/') && !(await coverExists(post.coverImage))) {
        missingFiles.push(post.slug)
      }
    }
    summary.push({
      category: category.name,
      total: category.posts.length,
      published: category.posts.filter(post => post.status === 'PUBLISHED').length,
      invalid: invalid.length,
    })
  }

  return { summary, missingFiles }
}

async function main() {
  if (!Number.isInteger(targetPerCategory) || targetPerCategory < 1 || targetPerCategory > 50) {
    throw new Error(`Meta inválida: ${targetPerCategory}`)
  }

  const plan = await buildPlan()
  const catalog = buildRegionalCatalog(plan.categories)
  const postsBySlug = new Map(plan.posts.map(post => [post.slug, post]))
  const refreshItems = catalog.filter(item => postsBySlug.has(item.article.slug))
  console.log('=== PLANO DE CONTEÚDO REGIONAL ===')
  console.log(`Categorias: ${plan.categories.length}`)
  console.log(`Matérias atuais: ${plan.posts.length}`)
  console.log(`Registros inválidos para remoção: ${plan.invalidPosts.length}`)
  plan.invalidPosts.forEach(post => console.log(`  - ${post.category.name}: ${post.title}`))
  console.log(`Novas matérias para atingir ${targetPerCategory} por categoria: ${plan.creations.length}`)

  const plannedByCategory = plan.creations.reduce((result, item) => {
    result[item.category.name] = (result[item.category.name] || 0) + 1
    return result
  }, {})
  Object.entries(plannedByCategory).forEach(([category, count]) => console.log(`  + ${category}: ${count}`))

  if (refreshCovers) {
    console.log(`Capas regionais existentes para simplificar: ${refreshItems.length}`)
    if (!applyChanges) {
      console.log('\nModo de auditoria: nenhuma alteração realizada. Use --refresh-covers --apply para executar.')
      return
    }

    await createDatabaseBackup('regional-cover-refresh')
    for (const item of refreshItems) {
      await createCover(item.article, item.category, item.sequence)
    }

    await db.$transaction(refreshItems.map(item => db.post.update({
      where: { slug: item.article.slug },
      data: {
        coverImage: item.article.coverImage,
        ogImage: item.article.ogImage,
      },
    })))

    const obsoleteCovers = new Set(refreshItems
      .map(item => postsBySlug.get(item.article.slug)?.coverImage)
      .filter(oldCover => oldCover && !oldCover.endsWith('-visual.webp')))
    await Promise.all([...obsoleteCovers].map(removeOldCover))

    const verification = await verifyDatabase()
    if (verification.missingFiles.length) {
      throw new Error(`Capas ausentes: ${verification.missingFiles.join(', ')}`)
    }
    console.log(`Capas WebP sem texto regeneradas: ${refreshItems.length}`)
    console.log(`Capas antigas removidas: ${obsoleteCovers.size}`)
    console.log('Banco atualizado para os novos arquivos e nenhuma capa regional está ausente.')
    return
  }

  if (!applyChanges) {
    console.log('\nModo de auditoria: nenhuma alteração realizada. Use --apply para executar.')
    return
  }

  await createDatabaseBackup('regional-news')

  for (let index = 0; index < plan.creations.length; index += 1) {
    const { article, category } = plan.creations[index]
    await createCover(article, category, index)
  }
  console.log(`Capas WebP geradas: ${plan.creations.length}`)

  await db.$transaction(async transaction => {
    if (plan.invalidPosts.length) {
      const invalidIds = plan.invalidPosts.map(post => post.id)
      await transaction.postReviewLog.deleteMany({ where: { postId: { in: invalidIds } } })
      await transaction.post.deleteMany({ where: { id: { in: invalidIds } } })
    }

    const baseDate = Date.now()
    for (let index = 0; index < plan.creations.length; index += 1) {
      const { category, article } = plan.creations[index]
      await transaction.post.create({
        data: {
          slug: article.slug,
          title: article.title,
          subtitle: article.subtitle,
          excerpt: article.excerpt,
          content: article.content,
          coverImage: article.coverImage,
          gallery: '[]',
          videos: '[]',
          customFields: article.customFields,
          categoryId: category.id,
          tags: article.tags,
          authorId: plan.author.id,
          status: 'PUBLISHED',
          featured: article.featured,
          breaking: false,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          seoKeywords: article.tags,
          ogImage: article.ogImage,
          views: 0,
          publishedAt: new Date(baseDate - index * 3 * 60 * 60 * 1000),
        },
      })
    }
  }, { timeout: 120000 })

  const verification = await verifyDatabase()
  console.log('\n=== VERIFICAÇÃO FINAL ===')
  console.table(verification.summary)
  if (verification.missingFiles.length) {
    throw new Error(`Capas ausentes: ${verification.missingFiles.join(', ')}`)
  }
  const invalidCategories = verification.summary.filter(item => item.total < targetPerCategory || item.invalid > 0)
  if (invalidCategories.length) {
    throw new Error(`Distribuição inválida após execução: ${JSON.stringify(invalidCategories)}`)
  }
  console.log('Banco consistente, capas locais presentes e meta por categoria atendida.')
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
