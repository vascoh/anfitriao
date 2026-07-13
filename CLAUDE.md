@AGENTS.md

# Anfitrião — guia para Claude Code

PMS para Alojamento Local português. Produção: https://anfitrioes.pt (multi-tenant via Clerk; projeto Supabase `nnbqfrszukkzoqwssjvg`).

## Comandos

- `npm test` — Vitest; correr sempre antes de deploy. A suite tem de passar em qualquer timezone.
- `npm run typecheck && npm run lint` — ambos a zero.
- Deploy: `npx vercel deploy --prod` (auto-deploy GitHub→Vercel está partido; nunca esperar por ele).
- ⚠️ WSL2: `npm run dev` (webpack) pendura sob carga e deixa zombies no porto 3000 — para E2E usar `npm run build && npm start` e matar `next-server` no fim.

## Convenções críticas

- **Datas**: usar sempre `today()`/`addDays()` de `lib/utils` — nunca `new Date().toISOString().slice(0,10)` (bug de TZ, corrigido 2026-07-13) nem aritmética manual de `Date`.
- **owner_id**: nullable em todas as tabelas; incluir sempre `owner_id` ao escrever. Upserts com admin client passam por `canUpsertRow` (lib/ownership.ts) para evitar IDOR.
- **Emails/push**: nunca criar endpoints públicos que enviem email — usar libs server-only (`notify-booking.ts`, `notify-checkin.ts`) chamadas das rotas. Push via `lib/push.ts` é independente do Resend.
- **Rotas públicas**: lista única em `src/proxy.ts`; qualquer rota nova é privada por omissão. Públicas precisam de rate limit (`lib/rate-limit.ts`) e validação com clamps.
- **iCal externo**: fetch só via `lib/ical-fetch.ts` (allowlist anti-SSRF).
- **Copy**: português de Portugal (AO90), sem brasileirismos (planilha→folha de cálculo, conecta→liga) nem inglês corporativo (sync→sincronizar).

## Documentos

- `PROGRESS.md` — log de sessões, decisões e pendentes humanos (atualizar no fim de cada sessão).
- `docs/HANDOFF.md` — estado detalhado, env vars, arquitetura de tenancy.
- Dados de teste em produção: prefixar `TESTE-E2E` e apagar no fim.
