# Changelog — Fase 3, incremento 1 (2026-07-26, sessão autónoma)

_Primeiro incremento da Fase 3, depois de fechar a Fase 2 (`CHANGELOG_PHASE_07.md`). Módulo Financeiro: despesas._

## Correção de avaliação antes de construir
Auditoria rápida ao `(app)/hospedes` mostrou que o **CRM já existe** de forma razoável — tags (`vip`/`problematico`/`frequente`/`novo`), notas e histórico de reservas por hóspede já estão implementados (`Guest.tags`/`Guest.notas`, UI em `hospedes/[id]/page.tsx`). A avaliação de "CRM fraco" em `SAAS_ARCHITECTURE.md` §0 estava desatualizada — corrigida. Da mesma forma, `/relatorios` já tem KPIs avançados (ADR, RevPAR, comparativos mensais, exportação CSV de receitas) — o gap real e não coberto era especificamente **despesas/lucro**, não "financeiro" em geral.

## Código
- Migration `018_expenses.sql` — tabela `expenses` (`owner_id`, `propriedade_id` opcional, `categoria` enum, `descricao`, `valor`, `data`), RLS sem políticas (só `service_role`, mesmo padrão de `accounts`/`push_subscriptions`).
- **Drift descoberto durante a aplicação**: `properties.id` é `text` em produção, não `UUID` como o ficheiro `001_schema_inicial.sql` local declara — a FK inicial falhou (`expenses_propriedade_id_fkey`), corrigida para `text`. Documentado em `docs/18-MANUAL-TECNICO.md` como aviso para migrations futuras.
- `types.ts` — `Expense`, `ExpenseCategoria`.
- `src/app/api/expenses/route.ts` — GET/POST/DELETE, mesmo padrão de `owner_id` forçado a partir de `auth()`, nunca do cliente.
- `src/lib/fetcher.ts` — `fetchExpenses()`.
- `(app)/financeiro/page.tsx` (nova) — KPIs (Receita/Despesas/Lucro do ano corrente, mesma definição de receita já usada em `/relatorios`: soma de `preco_total` de reservas não canceladas com check-in no ano), formulário de registo de despesa por categoria, lista com eliminação.
- Navegação: `Financeiro` adicionado a `side-nav.tsx` e `bottom-nav.tsx`.
- **Correção durante a implementação**: usei `new Date().toISOString().slice(0,10)` como default de data no endpoint — violação direta da convenção crítica do projeto (`AGENTS.md`: bug de TZ já corrigido antes). Substituído por `today()` de `lib/utils` antes de correr qualquer validação.

## Validação
`typecheck`/`lint`/`test` (118/118)/`build` limpos. Advisor de segurança: só o INFO esperado para `expenses` (mesmo padrão de tabelas sem política pública). Deploy em produção confirmado; `/financeiro` protegida exatamente como `/relatorios` (verificado por comparação direta).

## Próximo passo
Ver `TODO.md` → Fase 3: RBAC (Clerk Organizations), motor de automações, audit log, 2FA.
