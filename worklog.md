---
Task ID: slide-config-fix-001
Agent: main (Super Z)
Task: Corrigir bug onde as predefinições de seleção do slide da home não eram aplicadas — armazenamento dividido entre SlideConfig (Prisma) e SeoSetting.slide_config_global. Unificar vínculos e parametrização de filterType.

Work Log:
- Identificada a divisão de storage:
  - AdminSlideConfig.tsx → PUT /api/slide-config → grava em `SlideConfig` (Prisma, scope=GLOBAL)
  - AdminHomeConfig.tsx → PUT /api/seo → grava em `SeoSetting.home_layout_config` (slideEnabled/slidePostCount/slideFilterType)
  - /api/home/route.ts → lia apenas `SeoSetting.slide_config_global` (nunca populado por admin) → home nunca refletia o que o admin configurava
- Identificada divergência de vocabulário de filterType:
  - AdminSlideConfig usa: featured / latest / breaking / all
  - AdminHomeConfig usa: featured / breaking / views / recent
  - ListingView faz: featured→featured, breaking→breaking, latest→sortBy=recent, all→sortBy=views
  - /api/home/route trata: featured / breaking / views / (else=recent)
- Plano de correção:
  1. /api/home/route: ler SlideConfig (GLOBAL) como source of truth; fallback para SeoSetting.slide_config_global (legacy); fallback DEFAULT
  2. Padronizar filterType: featured / latest / breaking / all — com aliases views→all e recent→latest para back-compat
  3. AdminHomeConfig: remover campos de slide, substituir por card com link para a seção Slides
  4. AdminSlideConfig: adicionar nota explicando que a aba "Home (Global)" controla o slide da home

Stage Summary:
- /api/home/route.ts: agora lê slideConfig da tabela SlideConfig (scope=GLOBAL) como source of truth. Fallback em cascata: SeoSetting.slide_config_global (legacy) → defaults. filterType normalizado (featured/latest/breaking/all + aliases views→all, recent→latest). postCount e isEnabled também respeitam SlideConfig primeiro. Adicionado campo `source` e `slideConfigSource` em stats para transparência admin.
- /api/slide-config/route.ts PUT: validação completa de inputs — booleanos, inteiros com bounds (postCount 3-10, delayMs 3000-15000), enums (designType, heightPreset, filterType), com aliases views→all e recent→latest normalizados no write.
- ListingView.tsx: mapeamento de filterType atualizado para vocabulário unificado (featured/breaking/all/latest) com back-compat (views→sortBy=views, recent→sortBy=recent).
- AdminSlideConfig.tsx: adicionado banner informativo explicando vínculo Home (Global) vs Categoria, botões "Ver home" e "Ir para Home Layout", badges de escopo (Home/Categoria) e status (Ativo/Inativo) no título, e labels mais claras para filterType.
- AdminHomeConfig.tsx: removidos os campos slideEnabled/slidePostCount/slideFilterType (que causavam o bug de storage dividido). Substituídos por um card de aviso com botão "Abrir configuração de Slides" que navega para a seção dedicada. Adicionada info de "fonte do slide config" no stats. Back-compat: na leitura, campos legacy são stripped; no save, campos legacy são stripped antes do merge.
- Verificação: `tsc --noEmit` → EXIT 0; `eslint` nos 5 arquivos → EXIT 0.
