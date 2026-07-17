# Guia de Configuração — Categoria Patrocinada Enterprise

Este guia descreve como configurar e operar o sistema de anúncios Enterprise em categorias.

## 1. Configurar o gateway de pagamento (pré-requisito)

Acesse **Admin → Pagamentos** e configure pelo menos um gateway:
- **Asaas** (recomendado para PIX): https://sandbox.asaas.com/config/conta/notificacoes
- **Mercado Pago**: https://www.mercadopago.com.br/developers/panel/app
- **Stripe**: https://dashboard.stripe.com/webhooks

Configure também as URLs de webhook para:
- `https://[seu-dominio]/api/webhooks/asaas`
- `https://[seu-dominio]/api/webhooks/mercadopago`
- `https://[seu-dominio]/api/webhooks/stripe`

## 2. Configurar o cron job (obrigatório)

Adicione no crontab do servidor (roda a cada hora):

```bash
0 * * * * curl -s -H "Authorization: Bearer [SUA_CRON_SECRET]" "https://[seu-dominio]/api/cron/enterprise-check" > /dev/null 2>&1
```

A `CRON_SECRET` padrão é `portal-cron-2024` — altere via variável de ambiente `CRON_SECRET` no `.env`.

O cron:
- Marca ciclos mensais expirados como `EXPIRED` e pausa os anúncios
- Marca ciclos por impressões esgotados como `EXPIRED` e pausa os anúncios
- Notifica admin e empresa **3 dias antes** do vencimento mensal
- Notifica admin e empresa quando impressões atingem **80%** do limite

## 3. Cadastrar uma categoria patrocinada

1. Acesse **Admin → Categorias Patrocinadas**
2. Clique em **Configurar** na categoria desejada
3. Na aba **Configuração**, escolha o modo:
   - **Rotativo**: várias empresas (até 5) revezam
   - **Exclusivo**: 1 empresa tem a categoria + landing page
4. Configure:
   - Tipo de cobrança: `Mensal` (R$/mês) ou `Impressões` (R$ por N impressões)
   - Valor cobrado (em R$)
   - Máx. anúncios por empresa (apenas rotativo, 1-5)
   - Tipo de transição: `Fade` / `Slide` / `None`
   - Tempo de transição: 3000-10000 ms
   - Dimensões do banner (recomendado 1200×200 rotativo, 1200×400 exclusivo)
   - Contato comercial: nome, email, telefone
5. Clique em **Salvar configuração**

## 4. Vincular um usuário Enterprise

Para que uma empresa possa acessar o painel Enterprise:

1. Certifique-se de que a empresa já tem um usuário cadastrado no portal
2. Na aba **Cobrança**, clique em **Novo ciclo de cobrança**
3. Preencha:
   - User ID da empresa (encontre em **Admin → Usuários**)
   - Tipo e valor (ou use os defaults da configuração)
   - Status: `PENDING` (aguardando pagamento) ou `ACTIVE` (pago manual)
4. Para vincular o usuário como Enterprise (liberar o menu "Anúncio Enterprise"):
   - Use o endpoint `POST /api/admin/sponsored-categories/[id]/assign-user`
   - Body: `{"userId": "...", "companyName": "Nome da Empresa"}`

Após vincular, o usuário verá **"Anúncio Enterprise"** no menu do perfil (ícone coroa dourada).

## 5. Criar a landing page (apenas modo Exclusivo)

1. Na aba **Landing Page**, preencha todos os campos:
   - **Identidade**: nome da empresa, slug (URL), nicho
   - **Branding**: logo, cor primária, hero (título + subtítulo + imagem 1600×600)
   - **Conteúdo**: sobre (markdown), produtos/serviços (JSON), galeria, vídeos YouTube
   - **Contato**: telefone, WhatsApp, email, website
   - **Redes sociais**: Facebook, Instagram, YouTube, LinkedIn
   - **Geolocalização**: endereço, cidade, estado, CEP, latitude, longitude
   - **SEO**: title, description, keywords
2. Clique em **Salvar landing page**

A landing page ficará acessível em `https://[seu-dominio]/?empresa=[slug]`

## 6. Gerenciar anúncios

### Como admin:
1. Na aba **Anúncios**, clique em **Criar anúncio (admin)**
2. Preencha: User ID do dono, título, subtítulo, URLs (logo, imagem, vídeo, link), CTA
3. Status padrão: `PENDING` (aguarda aprovação)
4. Para aprovar: clique em **Aprovar** (muda para `ACTIVE`)
5. Para rejeitar: clique em **Rejeitar** (adicione motivo)

### Como empresa (no painel Enterprise):
1. Acesse **Menu → Anúncio Enterprise**
2. Na aba **Meus anúncios**, clique em **Criar anúncio**
3. Preencha os campos e salve — o anúncio fica `PENDING` até o admin aprovar
4. Para editar: clique no lápis — se o anúncio estava `ACTIVE`, volta para `PENDING` (re-review)

## 7. Pagamento e ativação automática

### Fluxo automático (com gateway configurado):
1. Admin cria o ciclo como `PENDING`
2. Empresa acessa **Menu → Anúncio Enterprise → Cobrança**
3. Clica em **Pagar** no ciclo pendente
4. É redirecionada para o checkout do gateway (PIX/Boleto/Cartão)
5. Após pagamento, o gateway envia webhook para `/api/webhooks/[provider]`
6. O webhook chama `activateEnterpriseCycleOnPayment()` que:
   - Marca o ciclo como `ACTIVE`
   - Define `startAt = agora` e `endAt = agora + 30 dias` (mensal)
   - Reativa todos os anúncios `PAUSED` da empresa
   - Notifica a empresa e o admin

### Fluxo manual (sem gateway):
1. Admin cobra a empresa externamente (transferência, etc.)
2. Cria o ciclo direto como `ACTIVE` na aba Cobrança
3. Os anúncios são ativados imediatamente

## 8. Quando o ciclo acaba

### Mensal:
- O cron verifica a cada hora
- Quando `endAt < agora`: ciclo → `EXPIRED`, anúncios → `PAUSED`
- Notificação enviada para admin e empresa
- 3 dias antes do vencimento: notificação de aviso prévio

### Por impressões:
- A cada impressão, `impressionsUsed` é incrementado
- Quando `impressionsUsed >= impressionsLimit`: ciclo → `EXPIRED`, anúncios → `PAUSED`
- Quando atinge 80%: notificação de aviso prévio

### Renovação:
- Empresa paga novamente → novo ciclo criado como `ACTIVE`
- Anúncios `PAUSED` são reativados automaticamente

## 9. Métricas disponíveis

### No painel admin (aba Métricas):
- Impressões totais (30 dias)
- Cliques totais (30 dias)
- CTR (click-through rate)
- Gráfico de barras: impressões por dia
- Lista de anúncios com performance individual

### No painel Enterprise:
- Cards: impressões, cliques, CTR, anúncios ativos
- Ciclo ativo atual (com progresso de impressões)
- Anúncios recentes com métricas individuais

## 10. Dimensões recomendadas

| Elemento | Dimensão | Formato |
|----------|----------|---------|
| Banner rotativo | 1200×200px | JPG/PNG |
| Banner exclusivo | 1200×400px | JPG/PNG |
| Landing page hero | 1600×600px | JPG |
| Logo da empresa | 200×200px | PNG transparente |
| Imagens da galeria | 800×600px | JPG (4:3) |
| Thumbnail de vídeo | 1200×675px | JPG (16:9) |

## 11. Endpoints da API

### Públicos:
- `GET /api/sponsored-categories/serve?categoryId=X` — serve anúncio
- `POST /api/sponsored-categories/click` — track de clique
- `GET /api/landing-page/[slug]` — landing page pública

### Admin:
- `GET /api/admin/sponsored-categories` — lista categorias
- `POST /api/admin/sponsored-categories` — cria/atualiza config
- `GET/PATCH/DELETE /api/admin/sponsored-categories/[id]` — detalhes/update/delete
- `POST /api/admin/sponsored-categories/[id]/ads` — cria anúncio
- `PATCH/DELETE /api/admin/sponsored-categories/[id]/ads/[adId]` — edita/remove
- `POST /api/admin/sponsored-categories/[id]/billing` — cria ciclo
- `POST /api/admin/sponsored-categories/[id]/landing-page` — salva landing
- `POST /api/admin/sponsored-categories/[id]/assign-user` — vincula usuário

### Enterprise (empresa):
- `GET /api/enterprise/me` — dashboard data
- `GET/POST /api/enterprise/ads` — lista/cria anúncios
- `PATCH/DELETE /api/enterprise/ads/[id]` — edita/remove
- `GET/POST /api/enterprise/landing-page` — landing page
- `GET /api/enterprise/metrics` — métricas detalhadas
- `GET /api/enterprise/billing` — ciclos
- `POST /api/enterprise/billing/[cycleId]/checkout` — gerar pagamento

### Cron:
- `GET /api/cron/enterprise-check` com `Authorization: Bearer [SECRET]` — verifica vencimentos

## 12. Solução de problemas

### Anúncio não aparece na categoria:
1. Verifique se o sponsor está `isActive: true` (admin > Configuração)
2. Verifique se há ciclo `ACTIVE` (admin > Cobrança)
3. Verifique se há anúncio `ACTIVE` (admin > Anúncios)
4. Verifique o console do browser — chame `GET /api/sponsored-categories/serve?categoryId=X` diretamente

### Empresa não vê o menu Enterprise:
1. Verifique se `EnterpriseUserLink` existe para o userId (`/api/auth/me` retorna `hasEnterpriseAccess`)
2. Re-vincule via `POST /api/admin/sponsored-categories/[id]/assign-user`

### Pagamento não ativou o ciclo:
1. Verifique se o webhook do gateway está configurado corretamente
2. Verifique os logs do servidor — procure por `[Enterprise] activateCycleOnPayment`
3. Confirme que o `paymentTransactionId` foi preenchido no ciclo

### Cron não está rodando:
1. Verifique o crontab: `crontab -l`
2. Teste manualmente: `curl -H "Authorization: Bearer [SECRET]" "https://[seu-dominio]/api/cron/enterprise-check"`
3. Deve retornar `{"ok":true,"checked":N,"expired":N,"warned":N}`
