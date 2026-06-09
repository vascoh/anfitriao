# Anfitrião — Progress Log

_Iniciado: 2026-06-06_

---

## Tarefas Concluídas

### [2026-06-06] Análise completa do projecto
- Lidos todos os ficheiros fonte (~100 ficheiros)
- Identificados bugs, riscos de segurança e oportunidades de melhoria

### [2026-06-06] Segurança e multi-tenancy
- ✅ Middleware Clerk (`src/middleware.ts`) — protecção de rotas, maintenance mode
- ✅ Página `/em-construcao` — acesso público durante manutenção
- ✅ `getWebsiteSettings()` corrigido — aceita `ownerId`, fallback para id=1
- ✅ `hoje/page.tsx` e `website/page.tsx` — passam `ownerId` ao DB

### [2026-06-06] Landing page
- ✅ Preços corrigidos: €19/€39 (alinhados com Stripe Price IDs em billing)
- ✅ Hero, features, pricing, CTA, footer

### [2026-06-06] SEO
- ✅ Root metadata (OG, Twitter Cards, description, keywords)
- ✅ `robots.ts` — permite landing, `/r/`, `/book/`; bloqueia app routes
- ✅ `sitemap.ts` — URL canónica da landing

### [2026-06-06] RLS Supabase (migration 008)
- ✅ `requesting_owner_id()` function criada
- ✅ RLS ativo em: properties, guests, bookings, website_settings, price_rules, tarifas, platform_rates, price_change_log
- ✅ Aplicado em produção (project `nnbqfrszukkzoqwssjvg`)

### [2026-06-06] Documentação
- ✅ `docs/HANDOFF.md` criado — estado completo, env vars, o que falta, passos de lançamento

### [2026-06-09] SEO, segurança e infraestrutura Clerk JWT
- ✅ `og:image` dinâmico em `/r/[slug]` — título do site do anfitrião, OG + Twitter cards
- ✅ `/r/[slug]` `robots: noindex` (site público de reservas não deve aparecer em resultados gerais)
- ✅ `createUserClient(token)` em `lib/supabase.ts` — cliente Supabase com Clerk JWT para RLS
- ✅ `lib/supabase-server.ts` — `getSupabaseForRequest()` helper server-only; usa JWT quando disponível, fallback para admin client + filtro manual
- ⚠️ Tabelas `fs_deals`, `fs_alerts`, `fs_price_history` sem RLS — ver secção Segurança abaixo

---

## Backlog (por prioridade)

### 🔴 Crítico (bloqueia lançamento público)
- [ ] Configurar Clerk JWT template no Supabase Dashboard → o RLS por owner_id só actua em chamadas client-side com JWT Clerk válido
  - Clerk Dashboard → Configure → JWT Templates → New → "Supabase"
  - Supabase Dashboard → Authentication → JWT Secret → copiar e colar no Clerk template
- [ ] Testar fluxo completo onboarding (novo user → propriedade → reserva → check-in)
- [ ] `MAINTENANCE_MODE=false` em Vercel → redeploy
- [ ] Resolver RLS das tabelas `fs_*` (ver secção Segurança)

### 🟡 Importante
- [ ] Onboarding wizard para novos anfitriões (melhorar `/conta/bem-vindo` com estado real)
- [x] Perfil do anfitrião editável (`/conta/perfil`) ✅
- [x] Export SIBA (CSV para portal SEF) ✅

### 🔵 UX/UI
- [ ] Página 404 melhorada (já existe, funcional)
- [x] og:image dinâmico ✅

### ⚪ Funcionalidades futuras
- [ ] Subdomain routing (`*.anfitrioes.pt`)
- [ ] Push notifications (PWA)
- [ ] Notificações email (nova reserva, check-in, pagamento)

---

## ⚠️ Segurança — Tabelas `fs_*` sem RLS

As tabelas `fs_deals`, `fs_alerts`, `fs_price_history` (provavelmente de outro projecto no mesmo Supabase) têm RLS **desactivado**. Qualquer pessoa com a anon key pode ler e modificar todos os dados.

**SQL para activar RLS (ATENÇÃO: activa RLS mas bloqueia todo o acesso sem políticas definidas):**

```sql
-- Só executar depois de definir políticas adequadas!
ALTER TABLE public.fs_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_price_history ENABLE ROW LEVEL SECURITY;
```

**Opção mais segura** — activar RLS com política de bloqueio total (se estas tabelas não são usadas pelo anfitriao):
```sql
ALTER TABLE public.fs_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_price_history ENABLE ROW LEVEL SECURITY;
-- Sem políticas = acesso bloqueado para anon e authenticated
-- service_role ainda tem acesso
```

Se estas tabelas são do projecto `luxe_radar`, adicionar políticas adequadas antes de activar RLS.

---

## Decisões de arquitectura tomadas

| Data | Decisão | Razão |
|---|---|---|
| 2026-06-06 | Preços landing → €19/€39 | Billing page é fonte autoritária (tem os Stripe Price IDs) |
| 2026-06-06 | MAINTENANCE_MODE=true por defeito | Site ainda não público, só admin acede |
| 2026-06-06 | Não alterar schema website_settings agora | Funciona para single-tenant; RLS cobre multi-tenant |
| 2026-06-06 | RLS usa `requesting_owner_id()` via JWT `sub` | Compatível com Clerk; service_role (API routes) bypassa RLS como esperado |
