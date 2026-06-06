# Anfitrião — Handoff

_Última actualização: 2026-06-06_

---

## Estado do projecto

**Em manutenção** (`MAINTENANCE_MODE=true`). Só o admin (`user_3DrUZjHebFBKAawGzhOfGzwwel6`) consegue aceder — todos os outros são redirecionados para `/em-construcao`.

O produto está funcionalmente completo para uso por um único anfitrião. O modelo de dados e o middleware já suportam multi-tenancy, mas ainda não foi feito o lançamento público.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Auth | Clerk |
| Base de dados | Supabase (Postgres), project `nnbqfrszukkzoqwssjvg` (eu-west-1) |
| Pagamentos | Stripe (subscriptions) |
| Deploy | Vercel, domínio `anfitrioes.pt` |
| IA | Anthropic Claude (OCR documentos, concierge) |

---

## Arquitectura

```
src/
  app/
    page.tsx              # Landing pública (redirect → /hoje se autenticado)
    em-construcao/        # Página de manutenção (acesso anon, sem auth)
    (app)/                # Layout protegido pelo Clerk
      hoje/               # Dashboard diário
      reservas/           # CRUD reservas
      hospedes/           # CRUD hóspedes
      propriedades/       # CRUD propriedades + iCal sync
      calendario/         # Vista calendário
      precos/             # Regras de preço
      relatorios/         # Revenue reports
      concierge/          # Chat IA
      documentos/         # OCR passaportes (SIBA)
      website/            # Config site reservas diretas
      conta/              # Conta / billing / Stripe
    (auth)/               # Sign-in / sign-up (Clerk hosted UI)
    (admin)/              # Admin panel (só admin)
    r/[slug]/             # Site de reservas diretas (público, por slug)
    book/                 # Booking flow
    checkin/              # Check-in online hóspedes
    api/                  # API routes (ical, stripe, concierge, etc.)
  lib/
    db.ts                 # Todas as queries Supabase
    types.ts              # Tipos TypeScript
    utils.ts              # Helpers
    supabase.ts           # Cliente Supabase (anon key)
  middleware.ts           # Clerk auth + maintenance mode
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
| 006 `multitenancy_foundation` | owner_id em todas as tabelas |
| 007 `accounts` | Tabela accounts (Stripe customer_id, plan, trial) |
| **008 `rls_owner_isolation`** | **RLS por owner_id em todas as tabelas — APLICADO 2026-06-06** |

### Nota importante — Clerk JWT

Para o RLS funcionar com utilizadores autenticados via browser (não service_role), o Supabase precisa de verificar o JWT do Clerk. Isto requer:

1. **Clerk Dashboard** → Configure → JWT Templates → New template → Supabase
2. **Supabase Dashboard** → Authentication → JWT → copiar o "JWT Secret" ou JWKS URL
3. O `requesting_owner_id()` function extrai o `sub` do JWT → filtra por `owner_id`

**Estado actual**: A função `requesting_owner_id()` está criada. O JWT template do Clerk ainda precisa de ser configurado para que o filtro por owner actue na camada DB. Enquanto não estiver configurado, o service_role (usado pelos API routes server-side) continua a funcionar correctamente — o risco é que chamadas directas ao Supabase REST com o JWT anon do Clerk não filtrem por owner.

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
```

---

## Funcionalidades prontas

- **Dashboard hoje** — chegadas, saídas, em casa, alertas, próximos 7 dias, vagas, receitas
- **Reservas** — CRUD completo, estados (pendente → confirmada → checkin → checkout), histórico
- **Hóspedes** — CRUD, campos SIBA completos, flag de verificação
- **Propriedades** — CRUD, suporte quartos (parent_id), cor, sync iCal multi-feed
- **iCal sync** — import Airbnb/Booking.com, export para subscrever, sync manual e automático (cron diário)
- **Check-in online** — link por reserva, formulário hóspede, upload documento com OCR (Claude Vision)
- **Concierge IA** — chat com contexto do alojamento, respostas em múltiplos idiomas
- **Documentos** — OCR de passaportes/CC para pré-preencher SIBA
- **Site reservas diretas** — `/r/[slug]`, calendário de disponibilidade, formulário de reserva
- **Preços** — tarifas base, regras por época/fim-de-semana, plataformas
- **Relatórios** — RevPAR, ocupação, receita por plataforma
- **Billing** — Stripe subscriptions (Starter €19/mês, Pro €39/mês), trial 14 dias
- **Auth** — Clerk (sign-in/sign-up), maintenance mode, admin bypass
- **PWA** — manifest, service worker, ícone adaptável
- **Dark mode** — toggle, persistência em localStorage, sem flash
- **Multi-tenancy** — owner_id em todas as tabelas, RLS ativo, middleware por tenant
- **SEO** — metadata root (OG, Twitter Cards), robots.txt, sitemap.xml

---

## O que falta para lançamento público

### Crítico (bloqueia abertura)

- [ ] **Configurar Clerk JWT template no Supabase** — necessário para o RLS filtrar por owner em chamadas client-side
- [ ] **Definir `MAINTENANCE_MODE=false`** em Vercel — depois de validar o JWT template
- [ ] **Testar fluxo completo de onboarding** — novo utilizador → criar propriedade → receber reserva

### Importante (antes de crescimento)

- [ ] **Onboarding wizard** — guia passo-a-passo para novos anfitriões
- [ ] **Página de perfil do anfitrião** (`/conta/perfil`) — nome, foto, contactos
- [ ] **Export SIBA** — ficheiro XML/CSV para o portal SEF (obrigação legal)
- [ ] **Subdomain routing** — `*.anfitrioes.pt` para o site de reservas diretas (actualmente `/r/[slug]`)

### Nice-to-have

- [ ] **Página 404 melhorada**
- [ ] **Notificações email** — nova reserva, check-in pendente, pagamento em falta
- [ ] **App móvel** (PWA já está, mas falta push notifications)
- [ ] **og:image** dinâmico para a landing page

---

## Passos para lançamento

1. Configurar Clerk JWT template no Supabase (ver secção acima)
2. Testar login com utilizador real e verificar que só vê os seus dados
3. Criar conta de teste → reserva → check-in → relatório
4. Validar Stripe webhook no Vercel (endpoint: `https://anfitrioes.pt/api/stripe/webhook`)
5. Definir `MAINTENANCE_MODE=false` em Vercel → redeploy
6. Anunciar

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
```
