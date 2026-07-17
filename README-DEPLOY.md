# Portal News — Guia de Deploy

Portal de notícias completo com painel administrativo, IA, WhatsApp, WordPress import, e mais.

## Requisitos

- **Node.js 20+**
- **MySQL 8+ ou MariaDB 10.4+**
- **npm**
- **500MB** de espaço em disco

## Instalação rápida (desenvolvimento)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# Configure DATABASE_URL=mysql://usuario:senha@host:3306/banco

# 3. Criar/atualizar tabelas do banco
npm run db:push

# 4. Rodar em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## Deploy de produção (standalone)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env

# 3. Criar/atualizar tabelas do banco
npm run db:push

# 4. Build de produção
npm run build
# Isso gera .next/standalone/ com tudo necessário

# 5. Iniciar servidor de produção
npm start
```

Acesse: http://localhost:3000 (ou a porta definida em `PORT`)

## Deploy em VPS com Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Deploy na Vercel (serverless)

```bash
# 1. Configurar para serverless
echo "DEPLOY_TARGET=serverless" >> .env

# 2. Configurar um MySQL/MariaDB externo
# DATABASE_URL=mysql://usuario:senha@host:3306/banco

# 3. Build serverless
npm run build:serverless

# 4. Deploy
vercel --prod
```

## Configuração pós-install

### 1. Acessar o painel admin
- URL: http://localhost:3000/?admin=true (ou clique no ícone de engrenagem no rodapé)
- Login: faça login com uma conta MASTER (criada via DB ou primeiro acesso)

### 2. Configurar SEO & Site
- Admin → Sistema → SEO & Site
- Preencha: nome do site, URL, cidade, estado, cor primária, logo
- Configure OpenGraph image (1200x630) para compartilhamento em redes sociais

### 3. Configurar integrações (opcional)
- **WordPress Import**: Admin → Integrações → WordPress
- **Redes Sociais**: Admin → Integrações → Redes Sociais (Facebook, Instagram, X, Telegram, WhatsApp)
- **IA Auto-News**: Admin → Integrações → IA Auto-News (geração automática de notícias)
- **WhatsApp**: Admin → Integrações → WhatsApp (notificações via Baileys)
- **Gateways de Pagamento**: Admin → Monetização → Pagamentos (Asaas, Mercado Pago, Stripe)

### 4. Criar categorias e editorias
- Admin → Sistema → Categorias

### 5. Publicar primeira notícia
- Admin → Conteúdo → Nova Notícia
- Ou use "Gerar com IA" para criar automaticamente

## Estrutura do projeto

```
├── src/
│   ├── app/              # Next.js App Router (páginas + APIs)
│   │   ├── api/          # 60+ rotas de API
│   │   ├── article/      # Páginas de artigo (com OG image dinâmica)
│   │   ├── layout.tsx    # Layout raiz com SEO dinâmico
│   │   └── page.tsx      # Home com metadata dinâmica
│   ├── components/
│   │   ├── admin/        # Painel administrativo (25+ componentes)
│   │   ├── portal/       # Portal público (home, article, classifieds)
│   │   └── ui/           # Componentes shadcn/ui + custom (RichTextEditor, ColorPicker, etc.)
│   └── lib/
│       ├── db.ts         # Prisma client
│       ├── seo.ts        # SEO settings dinâmicas
│       ├── auth.ts       # Autenticação (scrypt + tokens)
│       ├── html-to-markdown.ts  # Conversor WP HTML → Markdown
│       └── api-helpers.ts       # Helpers para APIs (safeReqJson)
├── prisma/
│   └── schema.prisma     # Schema completo (30+ models)
├── public/               # Assets estáticos (logo, og-default)
├── scripts/              # Scripts de build (sync-schema, resolve-symlinks)
└── .env.example          # Template de configuração
```

## Recursos principais

- ✅ Portal público com home, artigos, categorias, classificados, previsão do tempo
- ✅ Painel admin completo com 22 seções (dashboard, posts, IA, WordPress, etc.)
- ✅ Editor de notícias com RichTextEditor (preview ao vivo, toolbar rica, atalhos)
- ✅ Gerador de IA com 13+ templates e 4 colunas
- ✅ Importação WordPress com preview detalhado e mapeamento de categorias
- ✅ OpenGraph dinâmico por artigo (gera imagem 1200x630 automaticamente)
- ✅ SEO completo (JSON-LD: Organization, WebSite, NewsArticle, BreadcrumbList)
- ✅ Sistema de assinaturas e boost (Asaas, Mercado Pago, Stripe)
- ✅ Categorias patrocinadas Enterprise (modo exclusivo ou rotativo)
- ✅ WhatsApp via Baileys (notificações de publicação)
- ✅ Color picker visual para leigos (não precisa saber hex)
- ✅ Publicação automática em redes sociais
- ✅ Sistema de pontos, créditos, reações, verificação CPF/CNPJ
- ✅ Multi-idioma (pt-BR padrão)
- ✅ Dark mode no painel admin
- ✅ Responsivo (mobile, tablet, desktop)

## Suporte

Em caso de dúvidas, consulte:
- `worklog.md` (histórico de desenvolvimento)
- `prisma/schema.prisma` (estrutura do banco)
- Código comentado em `src/lib/`

## Licença

Proprietário — Todos os direitos reservados.
