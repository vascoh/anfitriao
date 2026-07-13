# Anfitrião

Gestão de Alojamento Local para anfitriões portugueses — reservas, check-in online com SIBA, sincronização iCal (Airbnb/Booking.com), preços, relatórios e concierge com IA.

**Produção:** [anfitrioes.pt](https://anfitrioes.pt)

## Stack

- **Next.js 16** (App Router, webpack) · TypeScript · Tailwind CSS 4
- **Clerk** (auth multi-tenant) · **Supabase** (Postgres + RLS) · **Stripe** (subscrições)
- **Anthropic Claude** (concierge multilingue, OCR de documentos)
- **Resend** (emails) · **web-push** (notificações) · PWA

## Comandos

```bash
npm run dev          # dev server (webpack) — ver nota WSL2 abaixo
npm run build        # build de produção
npm start            # servir o build
npm test             # Vitest (unit)
npm run test:watch
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

⚠️ **WSL2**: `next dev --webpack` pode pendurar sob carga (CPU spin). Para testes E2E locais usar `npm run build && npm start`.

## Deploy

O auto-deploy GitHub→Vercel está **desligado**. Deploy manual:

```bash
npm test && npm run build   # validar primeiro
npx vercel deploy --prod    # CLI já autenticada
```

## Estrutura

```
src/
  app/
    (app)/        # app autenticada (hoje, reservas, calendário, preços, …)
    (admin)/      # backoffice do admin
    api/          # API routes (auth Clerk, cron com CRON_SECRET, públicas rate-limited)
    book/         # site público de reservas por propriedade
    checkin/      # check-in online do hóspede (público, capability URL)
    r/[slug]/     # site público de cada anfitrião
  lib/            # lógica de negócio pura + clients (testada em *.test.ts)
  proxy.ts        # middleware Clerk: rotas públicas, maintenance mode, billing
supabase/migrations/
docs/HANDOFF.md   # estado detalhado, env vars, pendentes
PROGRESS.md       # log de sessões e decisões
```

## Ambiente

Copiar `.env.example` para `.env.local` e preencher. Chaves críticas: Clerk, Supabase (URL + anon key; `SUPABASE_SERVICE_ROLE_KEY` em produção), Stripe, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` (opcional), VAPID (web push), `CRON_SECRET`.

## Testes

- **Unit** (Vitest): `src/**/*.test.ts` — pricing, conflitos, iCal, SIBA/CSV, rate-limit, push, validação do /api/book. A suite passa em qualquer timezone.
- **E2E** (Playwright, scripts ad-hoc): fluxos públicos de reserva, multi-quarto e check-in validados em browser contra o build de produção.
