# Anfitrião — Handoff

_Última atualização: 2026-07-13_ · O histórico detalhado de sessões vive em `PROGRESS.md`.

---

## Estado do projecto

**Em manutenção** (`MAINTENANCE_MODE=true`). Só o admin (`user_3DrUZjHebFBKAawGzhOfGzwwel6`) consegue aceder — todos os outros são redirecionados para `/em-construcao`.

O produto está funcionalmente completo para uso por um único anfitrião. O modelo de dados e o middleware já suportam multi-tenancy, mas ainda não foi feito o lançamento público.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui |
| Testes | Vitest (unit, `npm test`); Playwright para E2E ad-hoc |
| Notificações | Resend (email) + web-push/VAPID (push PWA) |
| Auth | Clerk |
| Base de dados | Supabase (Postgres), project `nnbqfrszukkzoqwssjvg` (eu-west-1) |
| Pagamentos | Stripe (subscriptions) |
| Deploy | Vercel, domínio `anfitrioes.pt` |
| IA | Anthropic Claude Haiku (concierge streaming), Claude Sonnet (OCR documentos) |

---

## Arquitectura

```
src/
  app/
    page.tsx              # Landing pública (redirect → /hoje se autenticado)
    em-construcao/        # Página de manutenção (acesso anon, sem auth)
    (app)/                # Layout protegido pelo Clerk
      hoje/               # Dashboard diário (client component — carrega tudo na sidebar)
      reservas/           # CRUD reservas (fluxo 4 steps: propriedade → datas → hóspede → detalhes)
      hospedes/           # CRUD hóspedes (campos SIBA completos)
      propriedades/       # CRUD + iCal multi-feed
      calendario/         # Vista calendário
      precos/             # Regras de preço (price_rules, tarifas, platform_rates)
      relatorios/         # Revenue reports, CSV export
      concierge/          # Chat IA (streaming via SSE)
      documentos/         # OCR passaportes (SIBA)
      website/            # Config site reservas diretas
      conta/
        billing/          # Stripe subscriptions (Starter €19, Pro €39)
        perfil/           # Editar perfil anfitrião (nome, bio, contactos)
    (auth)/               # Sign-in / sign-up (Clerk hosted UI)
    (admin)/              # Admin panel (só admin)
    r/[slug]/             # Site de reservas diretas (público)
    book/                 # Booking flow (hóspede reserva diretamente)
    checkin/              # Check-in online hóspedes (público, sem auth)
    api/
      checkin/[id]/       # GET dados reserva (público); POST submeter check-in
      concierge/          # POST streaming (requer auth Clerk)
      documentos/extrair/ # POST OCR (público — usado no checkin; rate-limited 5/h/IP)
      ical/               # Export iCal por propriedade
      ical-sync/          # Sync manual/cron
      ical-proxy/         # Proxy para feeds externos (evitar CORS)
      properties/         # POST criar propriedade (verifica limite do plano)
      bookings/           # POST criar reserva (garante owner_id)
      siba-export/        # GET export CSV/XML hóspedes para SEF
      stripe/             # checkout, portal, webhook
      cron/               # trial-reminders, payment-reminders
  lib/
    db.ts                 # Queries Supabase (anon key, filtro por owner_id)
    accounts.ts           # Gestão contas (admin client, service_role)
    types.ts              # Tipos TypeScript
    utils.ts              # Helpers
    supabase.ts           # Clientes Supabase (anon + admin)
    rate-limit.ts         # In-memory rate limiter (sliding window por IP)
    siba.ts               # Geração CSV SIBA (escape + anti formula injection)
    push.ts               # Envio web-push aos dispositivos do anfitrião
    ical-fetch.ts         # Fetch de feeds iCal com allowlist anti-SSRF
    notify-booking.ts     # Emails+push de nova reserva (server-only)
    notify-checkin.ts     # Email+push de check-in concluído (server-only)
  proxy.ts                # Middleware Clerk: rotas públicas, maintenance mode, billing
```

---

## Base de dados — migrações aplicadas

| Migration | Conteúdo |
|---|---|
| 001 `initial_schema` | Schema base: properties, bookings, guests, website_settings |
| 002 `pricing_system` | price_rules, tarifas, platform_rates, price_change_log |
| 003 `seed_data` | Dados de exemplo |
| 004 `rls_security` | RLS inicial (anon policies) |
| 005 `rooms_support` | parent_id em properties (quartos dentro de apartamento) |
| 006 `multitenancy_foundation` | owner_id em todas as tabelas (nullable TEXT), slug em website_settings |
| 007 `accounts` | Tabela accounts (Stripe customer_id, plan, trial) |
| **008 `rls_owner_isolation`** | **RLS por owner_id — APLICADO 2026-06-06** |
| 009–011 (2026-06-30) | Hardening RLS: remoção de policies blanket `authenticated_full_*`, UPDATE anon mortos, consolidação de INSERT anon |
| 012 `push_subscriptions` | Subscrições web-push (RLS ativo sem políticas — só service_role) — 2026-07-13 |

### Nota crítica — `owner_id` é nullable

Todas as colunas `owner_id` foram adicionadas como `TEXT` (nullable). Isso significa que registos criados sem `owner_id` ficam com NULL e **não aparecem** ao utilizador quando o RLS está ativo com o JWT do Clerk.

Implicação: criar reservas ou hóspedes diretamente via `db.saveBooking()` / `db.saveGuest()` no browser (sem incluir `owner_id`) resulta em registos "órfãos" invisíveis ao dono. **Sempre incluir `owner_id: userId` nos objetos antes de guardar.**

### Nota crítica — Clerk JWT template

Para o RLS funcionar com utilizadores autenticados via browser (não service_role), o Supabase precisa de verificar o JWT do Clerk. Requer:

1. **Clerk Dashboard** → Configure → JWT Templates → New template → Supabase
2. **Supabase Dashboard** → Authentication → JWT → copiar JWKS URL
3. A função `requesting_owner_id()` extrai o `sub` do JWT → filtra por `owner_id`

**Estado actual**: A função está criada. O JWT template ainda **não está configurado**. Enquanto não estiver, chamadas client-side com anon key não filtram por owner (todos vêem tudo). O service_role (API routes server-side) funciona corretamente — contorna o RLS.

---

## Segurança — arquitectura de tenancy

```
Browser (anon key) → Supabase RLS → filtra por requesting_owner_id()
Server (service_role) → Supabase → bypassa RLS → filtra por owner_id= nos queries
```

### Rotas com auth server-side correcto
- `POST /api/properties` — verifica auth Clerk, adiciona owner_id, verifica limite plano
- `POST /api/bookings` — verifica auth Clerk, adiciona owner_id
- `GET/POST /api/stripe/*` — auth Clerk ou assinatura Stripe
- `(app)/**` — protegido pelo middleware Clerk

### Rotas públicas por design
- `GET /api/checkin/[id]` — público (guests acedem sem conta). Retorna PII mínimo; não expõe todos os dados do anfitrião
- `POST /api/checkin/[id]` — público (guests submetem check-in)
- `POST /api/documentos/extrair` — público (usado no checkin flow). Rate-limited: 5 req/hora/IP
- `GET /api/ical/[propertyId]` — público (subscrição iCal)
- `GET /r/[slug]` — site de reservas diretas (público)

### Rotas que requerem auth (verificado)
- `POST /api/concierge` — requer userId Clerk (401 se não autenticado)

---

## Env vars necessárias

### `.env.local` (local) e Vercel (produção)

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/hoje
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/hoje

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://nnbqfrszukkzoqwssjvg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=https://anfitrioes.pt
ADMIN_USER_ID=user_3DrUZjHebFBKAawGzhOfGzwwel6
NEXT_PUBLIC_ADMIN_USER_ID=user_3DrUZjHebFBKAawGzhOfGzwwel6

# Maintenance (remover ou false para abrir ao público)
MAINTENANCE_MODE=true

# Web Push (VAPID) — gerar com: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:suporte@anfitrioes.pt

# Emails (opcional — sem RESEND_API_KEY os emails são no-op)
RESEND_API_KEY=
NOTIFY_FROM=

# Cron (produção)
CRON_SECRET=
```

---

## Funcionalidades prontas

- **Dashboard hoje** — chegadas, saídas, em casa, alertas, próximos 7 dias, vagas, receitas
- **Reservas** — CRUD completo, estados, conflito de datas, preço automático com regras
- **Hóspedes** — CRUD, campos SIBA completos, flag de verificação
- **Propriedades** — CRUD, suporte quartos (parent_id), cor, sync iCal multi-feed
- **iCal sync** — import Airbnb/Booking.com, export, sync manual e automático (cron diário)
- **Check-in online** — link por reserva, formulário hóspede, upload documento com OCR (Claude Vision)
- **Concierge IA** — chat streaming com contexto do alojamento, respostas multi-idioma (auth requerida)
- **Documentos** — OCR de passaportes/CC para pré-preencher SIBA
- **Export SIBA** — CSV com dados de hóspedes para submissão ao portal SEF (`/api/siba-export`)
- **Site reservas diretas** — `/r/[slug]`, calendário, formulário de reserva
- **Preços** — tarifas base, regras por época/fim-de-semana, plataformas
- **Relatórios** — RevPAR, ocupação, receita por plataforma, export CSV
- **Billing** — Stripe subscriptions (Starter €19/mês, Pro €39/mês), trial 14 dias
- **Auth** — Clerk (sign-in/sign-up), maintenance mode, admin bypass
- **Perfil** — `/conta/perfil` — nome do anfitrião, bio, email, telefone
- **PWA** — manifest, service worker, ícone adaptável
- **Dark mode** — toggle, persistência em localStorage, sem flash
- **Multi-tenancy** — owner_id em todas as tabelas, RLS ativo, middleware por tenant
- **SEO** — metadata root (OG, Twitter Cards), robots.txt, sitemap.xml

---

## O que falta para lançamento público

### Crítico (bloqueia abertura)

- [ ] **Configurar Clerk JWT template no Supabase** — necessário para o RLS filtrar por owner em chamadas client-side (ver instrução acima)
- [ ] **Testar fluxo completo de onboarding** — novo utilizador → criar propriedade → receber reserva → check-in
- [ ] **Definir `MAINTENANCE_MODE=false`** em Vercel — depois de validar o JWT template

### Decisões humanas pendentes (2026-07-13)

- [ ] **Testemunhos da landing** — os 3 testemunhos aparentam ser fictícios (produto não lançado): substituir por beta reais, remover ou marcar como ilustrativos
- [ ] **Contraste AA** — ~54 nós falham WCAG AA (texto branco sobre terracotta `#C2714F` ≈ 3.5:1); corrigir implica escurecer a paleta (ex: `#A85A3B`)
- [ ] **Wildcard DNS** para subdomain routing (`*.anfitrioes.pt`)

### Importante (antes de crescimento)

- [x] Onboarding wizard ✅ (verificado 2026-07-10, usa estado real)
- [x] Notificações email ✅ (nova reserva, confirmação, check-in, lembretes de pagamento via cron — requerem `RESEND_API_KEY`)
- [x] Push notifications PWA ✅ (2026-07-13 — toggle em `/conta/perfil`)
- [ ] **Subdomain routing** — `*.anfitrioes.pt` (atualmente `/r/[slug]`)
- [ ] **Sync iCal mais frequente** — cron 1×/dia é o limite do plano Vercel Hobby; com clientes, subir a Pro e sync horário

### Nice-to-have

- [ ] **Migração `owner_id NOT NULL`** — depois de todos os dados de produção terem owner_id preenchido, adicionar constraint NOT NULL para prevenir registos órfãos

---

## Bugs conhecidos

| # | Ficheiro | Descrição | Prioridade |
|---|---|---|---|
| ~~B1~~ | ~~`db.ts` getters por ID sem owner_id~~ | ✅ Resolvido 2026-07-13: eram código morto sem callers — removidos. `db.ts` ficou só com os 3 getters usados pelas páginas públicas `/book` | — |
| ~~B2~~ | ~~`db.ts` `getPriceRules`/`getTarifas`/`getPlatformRates`~~ | ✅ Resolvido 2026-07-13: código morto removido (as páginas usam API routes) | — |
| B3 | `hoje/page.tsx` | Carrega TODOS os bookings históricos via API — lento com muitos dados. `pagamentosEmFalta` justifica o carregamento completo por agora | Baixo |

---

## Passos para lançamento

1. Configurar Clerk JWT template no Supabase (ver secção acima)
2. Testar login com utilizador real — verificar que só vê os seus dados
3. Criar conta de teste → propriedade → reserva → check-in → relatório
4. Verificar perfil `/conta/perfil` e website `/r/[slug]`
5. Validar Stripe webhook no Vercel (endpoint: `https://anfitrioes.pt/api/stripe/webhook`)
6. Definir `MAINTENANCE_MODE=false` em Vercel → redeploy
7. Anunciar

---

## Comandos úteis

```bash
# Dev local
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build

# Ver migrações aplicadas
# → Supabase Dashboard → Database → Migrations

# Aplicar nova migração via CLI
supabase db push

# Export SIBA (CSV hóspedes)
# GET /api/siba-export?from=YYYY-MM-DD&to=YYYY-MM-DD
# (requer auth Clerk)
```
