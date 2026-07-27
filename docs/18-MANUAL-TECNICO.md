# Manual Técnico

Ver `README.md` (raiz do projeto) para setup local, comandos e estrutura de pastas — não duplicado aqui.

## Convenções obrigatórias (ver `AGENTS.md`/`CLAUDE.md` do projeto)
- Datas: sempre `today()`/`addDays()` de `lib/utils`, nunca `new Date().toISOString()` manual (bug de TZ histórico).
- `owner_id`: obrigatório em toda a escrita; upserts via admin client passam por `canUpsertRow` (`lib/ownership.ts`).
- Emails/push: só via libs server-only (`notify-*.ts`); nunca endpoint público que envie diretamente.
- Rotas públicas: lista única em `src/proxy.ts`; nova rota é privada por omissão.
- iCal externo: só via `lib/ical-fetch.ts` (allowlist anti-SSRF) — nunca `fetch()` direto a URLs de utilizador.
- Copy: português de Portugal (AO90), sem brasileirismos nem inglês corporativo.

## Drift conhecido entre migrations locais e produção
`supabase/migrations/001_schema_inicial.sql` declara `properties.id` como `UUID`, mas a coluna real em produção é `text` (confirmado por `information_schema.columns`, 2026-07-26 — provável alteração aplicada fora do histórico local de migrations, ou os ficheiros locais não refletem 100% o que foi aplicado). **Antes de criar uma FK para `properties.id` numa tabela nova, confirmar o tipo real em produção** (`select data_type from information_schema.columns where table_name='properties' and column_name='id'`) em vez de assumir a partir do ficheiro de migration local — já causou um erro de aplicação (`expenses_propriedade_id_fkey`, corrigido na migration 018).

## Padrão para features novas multi-tenant
1. Migration nova com `owner_id` + RLS via `requesting_owner_id()` (nunca reabrir policies `authenticated_full_*` — removidas deliberadamente, ver `PROGRESS.md` 2026-06-30).
2. Rota de API: `service_role` (admin client) com filtro explícito por `owner_id`, ou client owner-scoped via JWT Clerk (`getSupabaseForRequest`).
3. Teste unitário (Vitest) para lógica de negócio pura em `lib/`.
4. Atualizar `PROGRESS.md` no fim da sessão.

## Onde cada camada vive
- `src/app/(app)/` — painel autenticado.
- `src/app/(admin)/` — backoffice interno.
- `src/app/api/` — Route Handlers (autenticadas, cron, ou públicas rate-limited).
- `src/app/r/[slug]`, `src/app/book/`, `src/app/checkin/` — superfícies públicas.
- `src/lib/` — lógica de negócio pura e clients, testada.

## Testes
- Unit: `src/**/*.test.ts` (Vitest) — corre em 3 timezones (Lisboa, Tóquio, Los Angeles).
- E2E: Playwright ad-hoc contra `npm run build && npm start` (não `npm run dev` — pendura sob carga em WSL2).
