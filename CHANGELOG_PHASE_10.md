# Changelog — Fase 3, incremento 3 (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_09.md`. Audit log genérico — só para ações sensíveis/irreversíveis, não instrumentação total (ver critério em `docs/09-SEGURANCA.md`)._

## Código
- Migration `020_audit_log.sql` — tabela `audit_log` (`actor_id` nullable = sistema/webhook, `entidade`, `entidade_id`, `acao`, `detalhes jsonb`), RLS sem políticas (só `service_role`).
- `src/lib/audit.ts` — `logAudit()`, nunca lança (mesmo princípio de `sendPushToOwner`: auditoria não pode bloquear o fluxo principal).
- **Ponto de instrumentação único e de alto valor**: `lib/accounts.ts` — `updateAccount()`/`updateAccountByCustomerId()` (usadas tanto pelo webhook Stripe como pelo override manual do admin) passaram a comparar `estado`/`plano` antes/depois e registar no audit log quando mudam. Uma só alteração cobre **billing automático (Stripe) e intervenção manual do admin** — não foi preciso instrumentar cada handler do webhook individualmente.
- `updateAccount()` ganhou parâmetro opcional `actorId` (Clerk userId de quem fez a alteração; `null` = sistema). `(admin)/admin/contas/[id]/actions.ts` passa o `userId` do admin autenticado.
- `DELETE /api/properties` — regista `property.eliminada` no audit log (ação irreversível, cascata para reservas/hóspedes).
- `(admin)/admin/contas/[id]/page.tsx` — nova secção "Histórico de alterações" mostrando as últimas 10 entradas do audit log da conta (quem, o quê, quando).

## Validação
- `typecheck`/`lint`/`test` (118/118)/`build` — limpos.
- Advisor de segurança: só INFO esperado (`audit_log` sem políticas, mesmo padrão de `expenses`/`automations`).
- **Teste E2E parcial, com justificação**: invocar a Server Action do admin diretamente por HTTP não é praticável de forma segura fora de um browser autenticado (Server Actions do Next.js não são um endpoint REST simples). Em vez disso, validei por SQL que a tabela aceita o formato exato de dados que o código produz e que a query usada em `page.tsx` (`entidade='account' AND entidade_id=...`) devolve e ordena corretamente — dado de teste `TESTE-E2E-admin` inserido e removido. A lógica de comparação `before`/`after` em `lib/accounts.ts` foi validada por leitura de código (simples, tipada, sem efeitos secundários condicionais escondidos).

## Não incluído (deliberado)
- Não instrumentei eliminação de `expenses`/`automations` nem outras mutações menores — não são irreversíveis o suficiente para justificar o registo (o critério em `docs/09-SEGURANCA.md` é explícito: só ações sensíveis/irreversíveis, não tudo).
- Sem UI de pesquisa/filtro no audit log além da vista por conta — suficiente para o volume atual; revisitar se o audit log crescer e precisar de uma vista agregada `(admin)/admin/auditoria`.

## Próximo passo
Ver `TODO.md` → Fase 3: falta RBAC (Clerk Organizations — pendência humana sobre prioridade) e 2FA (configuração no Clerk Dashboard, não código). Com isto, a Fase 3 tem CRM, Financeiro, Automações e Audit log cobertos.
