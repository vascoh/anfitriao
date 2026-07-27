# Changelog — Fase 1.5 (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_01.md`, sem intervenção humana durante a execução conforme pedido._

## Auditoria de segurança — correção de risco face ao planeamento anterior
`docs/SAAS_ARCHITECTURE.md` (versão da Fase 0) classificava "ativar Clerk JWT template" como pendência **crítica que bloqueia lançamento**. Auditoria ao código mostrou que essa classificação estava errada:

- `getSupabaseForRequest()`/`getSupabaseUserClient()` (`src/lib/supabase-server.ts`) — helper pensado para usar RLS via JWT Clerk — **nunca é importado em lado nenhum do código**. É infraestrutura pronta mas nunca ligada.
- Auditadas as 20 rotas de API existentes (`grep` sistemático a `auth()`/`userId`/`owner_id`/`createAdminClient`): **100% das rotas autenticadas** usam `service_role` (bypassa RLS) com filtro explícito `.eq('owner_id', userId)`, onde `userId` vem sempre de `auth()` (sessão Clerk verificada server-side), nunca do corpo do pedido. Rotas sem filtro (`checkin/[bookingId]`, `documentos/extrair`) são intencionalmente públicas (capability URL / rate-limited), documentadas como tal.
- **Conclusão:** o isolamento multi-tenant real em produção não depende do JWT template do Clerk — é imposto de forma consistente a nível de aplicação. Não é o desenho ideal a longo prazo (RLS a nível de BD é mais robusto a erro humano futuro), mas não é uma falha de segurança ativa nem bloqueia comercialização.
- Prioridade revista: de 🔴 crítico para 🟡 melhoria de defesa em profundidade — decisão sobre quando investir nisso passa para "Pendências para Validação Humana" (não é urgente).

## `MAINTENANCE_MODE`
Confirmado `false` em produção por verificação HTTP direta (`curl` a `https://anfitrioes.pt/` e `/sign-up`): ambos devolvem 200 sem redirect para `/em-construcao` e sem marcadores de manutenção no HTML. Já não é uma pendência.

## Onboarding ponta-a-ponta
Validado por leitura de código (fluxo de registo → conta → propriedade → reserva → check-in existe e cada rota está corretamente owner-scoped, ver auditoria acima). Não foi corrido um teste E2E ao vivo contra produção nesta sessão — criar/apagar dados reais em produção sem supervisão humana presente foi avaliado como risco desnecessário face ao ganho de confiança (o código já dá garantia suficiente). Ver `AGENTS.md` para a convenção `TESTE-E2E` a usar quando esse teste for corrido com supervisão.

## Fase 1.5 — Estado
✅ Concluída. Nenhuma alteração de código nesta fase (só auditoria/documentação) — sem necessidade de deploy.

## Próximo passo
Fase 2 (templates de website) — ver `TODO.md`.
