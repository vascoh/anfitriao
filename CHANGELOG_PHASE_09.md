# Changelog — Fase 3, incremento 2 (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_08.md`. Motor de automações — primeiro incremento (email ao hóspede)._

## Código
- Migrations `019_automations.sql`: `automations` (regra: nome, `trigger_tipo`, `action_tipo`, assunto/mensagem com placeholders, ativo) + `automation_log` (auditoria + idempotência via `UNIQUE (automation_id, booking_id)`).
- **Verificação prévia dos tipos de coluna** (lição de `CHANGELOG_PHASE_08.md`): confirmado `bookings.id`/`guests.id` como `text` antes de desenhar as FKs — sem erro desta vez.
- `types.ts` — `Automation`, `AutomationTrigger`, `AutomationAction`.
- `lib/email/templates/automation.ts` + `EmailService.sendAutomationMessage` — email de alojamento (identidade do anfitrião, Reply-To correto) com o texto livre da automação.
- `src/app/api/automations/route.ts` — CRUD owner-scoped (mesmo padrão de `expenses`).
- `src/app/api/cron/automations/route.ts` — cron diário (`vercel.json`, 08:00): para cada automação ativa, procura reservas confirmadas/pendentes que batem com o gatilho (`checkin_amanha` = check-in amanhã, `checkout_hoje` = checkout hoje), substitui `{nome}`/`{propriedade}`/`{checkin}`/`{checkout}` na mensagem, envia e regista em `automation_log`. **Idempotência verificada antes de enviar** (consulta `automation_log` existente antes do loop de envio — evita reenvio se o cron correr duas vezes no mesmo dia).
- `(app)/automacoes/page.tsx` — criar/ativar-desativar/eliminar automações. Navegação atualizada (`side-nav.tsx`/`bottom-nav.tsx`).

## Correção durante a implementação
Primeira versão do cron só registava em `automation_log` **depois** de enviar o email, o que permitiria reenvio duplicado se o cron corresse duas vezes seguidas antes do primeiro registo. Corrigido para consultar os logs existentes **antes** do loop de envio.

## Validação
- `typecheck`/`lint`/`test` (118/118)/`build` — limpos.
- Advisor de segurança: só INFO esperado (`automations`/`automation_log` sem políticas — mesmo padrão de `expenses`).
- Endpoint do cron testado ao vivo: `401` sem header de autorização e com secret errado (mesma proteção dos crons existentes). **Não tentei extrair o `CRON_SECRET` real** (está marcado como sensível no Vercel deliberadamente) — em vez disso, validei a lógica de dados diretamente por SQL com dados `TESTE-E2E`: a query de reservas por gatilho encontra corretamente a reserva/hóspede de teste, e a constraint `UNIQUE` de idempotência rejeita corretamente uma segunda tentativa de log. Dados de teste removidos no fim.
- Deploy em produção confirmado; `/automacoes` protegida exatamente como as outras páginas autenticadas.

## Não incluído (deliberado)
- Só 2 gatilhos (check-in amanhã / checkout hoje) e 1 ação (email ao hóspede) — cobre os casos mais pedidos (código da porta, lembretes, pedido de avaliação, todos possíveis com o texto livre já suportado). Push/WhatsApp/SMS como ação ficam para quando houver procura — a estrutura (`action_tipo` enum) já permite adicionar sem redesenho.
- Sem UI de preview da mensagem renderizada — melhoria de UX de baixo custo para um próximo incremento.

## Próximo passo
Ver `TODO.md` → Fase 3: RBAC (Clerk Organizations, pendência humana sobre prioridade), audit log genérico, 2FA (configuração no Clerk Dashboard).
