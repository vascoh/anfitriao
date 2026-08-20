@AGENTS.md

# Anfitrião — guia para Claude Code

PMS para Alojamento Local português. Produção: https://anfitrioes.pt (multi-tenant via Clerk; projeto Supabase `nnbqfrszukkzoqwssjvg`).

## Comandos

- `npm test` — Vitest; correr sempre antes de deploy. A suite tem de passar em qualquer timezone.
- `npm run typecheck && npm run lint` — ambos a zero.
- Deploy: `npx vercel deploy --prod` (auto-deploy GitHub→Vercel está partido; nunca esperar por ele).
  - ⚠️ O deploy demora mais de 5 minutos e **não** promove o alias de forma fiável. Confirmar sempre com
    `npx vercel inspect https://anfitrioes.pt` que a data de criação é a de agora.
  - ⚠️ `npx vercel promote <url>` só serve para promover um deploy **acabado de criar**. Promover um URL
    antigo faz a produção recuar para esse código — aconteceu a 2026-08-20, com a produção a voltar
    dois dias atrás sem nada a assinalá-lo. Verificar a data com `vercel inspect <url>` antes de promover.
- ⚠️ WSL2: `npm run dev` (webpack) pendura sob carga e deixa zombies no porto 3000 — para E2E usar `npm run build && npm start` e matar `next-server` no fim.

## Convenções críticas

- **Datas**: usar sempre `today()`/`addDays()` de `lib/utils` — nunca `new Date().toISOString().slice(0,10)` (bug de TZ, corrigido 2026-07-13) nem aritmética manual de `Date`.
- **owner_id**: nullable em todas as tabelas; incluir sempre `owner_id` ao escrever. Upserts com admin client passam por `canUpsertRow` (lib/ownership.ts) para evitar IDOR.
- **Emails/push**: nunca criar endpoints públicos que enviem email — usar libs server-only (`notify-booking.ts`, `notify-checkin.ts`) chamadas das rotas. Push via `lib/push.ts` é independente do Resend.
- **Rotas públicas**: lista única em `src/proxy.ts`; qualquer rota nova é privada por omissão. Públicas precisam de rate limit e validação com clamps — e o limitador tem de ser `verificarLimite` (`lib/rate-limit-persistente.ts`), que conta na base: o `checkRateLimit` em memória conta por instância e não trava pedidos simultâneos (medido em produção a 2026-08-20).
- **iCal externo**: fetch só via `lib/ical-fetch.ts` (allowlist anti-SSRF).
- **Copy**: português de Portugal (AO90), sem brasileirismos (planilha→folha de cálculo, conecta→liga) nem inglês corporativo (sync→sincronizar).

## Documentos

- `PROGRESS.md` — log de sessões, decisões e pendentes humanos (atualizar no fim de cada sessão).
- `docs/HANDOFF.md` — estado detalhado, env vars, arquitetura de tenancy.
- Dados de teste em produção: prefixar `TESTE-E2E` e apagar no fim.
