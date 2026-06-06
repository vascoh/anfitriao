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

---

## Backlog (por prioridade)

### 🔴 Crítico (bloqueia lançamento público)
- [ ] Configurar Clerk JWT template no Supabase Dashboard → o RLS por owner_id só actua em chamadas client-side com JWT Clerk válido
- [ ] Testar fluxo completo onboarding (novo user → propriedade → reserva → check-in)
- [ ] `MAINTENANCE_MODE=false` em Vercel → redeploy

### 🟡 Importante
- [ ] Onboarding wizard para novos anfitriões
- [ ] Perfil do anfitrião editável (`/conta/perfil`)
- [ ] Export SIBA (XML/CSV para portal SEF) — obrigação legal

### 🔵 UX/UI
- [ ] Página 404 melhorada
- [ ] og:image dinâmico para landing page

### ⚪ Funcionalidades futuras
- [ ] Subdomain routing (`*.anfitrioes.pt`)
- [ ] Push notifications (PWA)
- [ ] Notificações email (nova reserva, check-in, pagamento)

---

## Decisões de arquitectura tomadas

| Data | Decisão | Razão |
|---|---|---|
| 2026-06-06 | Preços landing → €19/€39 | Billing page é fonte autoritária (tem os Stripe Price IDs) |
| 2026-06-06 | MAINTENANCE_MODE=true por defeito | Site ainda não público, só admin acede |
| 2026-06-06 | Não alterar schema website_settings agora | Funciona para single-tenant; RLS cobre multi-tenant |
| 2026-06-06 | RLS usa `requesting_owner_id()` via JWT `sub` | Compatível com Clerk; service_role (API routes) bypassa RLS como esperado |
