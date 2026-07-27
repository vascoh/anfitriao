# Changelog — Fase 1 (2026-07-26)

_Fase 0 (planeamento) e Fase 1 (primeira fatia de código real) da mesma sessão. Contexto completo em `docs/SAAS_ARCHITECTURE.md` e `TODO.md`._

## Planeamento
- `docs/SAAS_ARCHITECTURE.md` — arquitetura funcional e técnica completa (auditoria do existente, personas, fluxos, channel manager, templates, RBAC, segurança, escalabilidade, roadmap, benchmark, pendências).
- Suite `/docs` completa (19 ficheiros): visão, arquitetura (decisão de isolamento multi-tenant justificada), roadmap, personas, casos de uso, fluxos, modelo de dados, APIs, integrações, segurança, deploy, SEO/performance, plano comercial, marketing, preços, checklist de produção, manuais (cliente/admin/técnico).
- `TODO.md` — estado vivo por fase.
- **Correção importante**: a primeira versão do documento de arquitetura listava "export iCal por propriedade" como gap — verificação ao código mostrou que **já estava implementado** (`api/ical/[propertyId]/route.ts`, com UID hasheado para privacidade). Corrigido antes de avançar, evitando trabalho duplicado.

## Código — Preferências de notificações (owner-scoped)
Fecha o gap "sistema de preferências de notificações" identificado no planeamento, ligado a um evento que já existe (nova reserva).

- **Migration** `013_notification_preferences.sql` (aplicada em produção via Supabase MCP): tabela `notification_preferences` (`owner_id` PK, `nova_reserva_email`, `nova_reserva_push`, defaults `true`), RLS ativo sem políticas (mesmo padrão de `push_subscriptions`/`accounts` — só `service_role` acede), trigger `atualizado_em` com `SET search_path = ''` (convenção de segurança do projeto).
- `src/lib/notification-preferences.ts` — `getNotificationPreferences`/`upsertNotificationPreferences`, com defaults seguros quando não há registo.
- `src/app/api/notification-preferences/route.ts` — GET/POST autenticados via Clerk (privado por omissão, sem entrada necessária em `proxy.ts`).
- `src/lib/notify-booking.ts` — `sendBookingNotification` agora respeita as preferências do anfitrião antes de enviar push e/ou email de nova reserva (o email ao hóspede não é afetado — preferência é só do lado do anfitrião).
- `src/components/notification-email-toggle.tsx` — toggle na página `Perfil`, ao lado do `PushToggle` já existente.

## Validação
- `npm run typecheck` — 0 erros.
- `npm run lint` — 0 erros, 0 warnings (1 warning de `exhaustive-deps` corrigido).
- `npm test` — 118/118 testes a passar.
- `npm run build` — sucesso.
- Advisor de segurança Supabase pós-migration: 0 ERROR, só INFO esperado (`rls_enabled_no_policy` na tabela nova, mesmo padrão já aceite) + o WARN irredutível já documentado (`public_insert_guests`).
- Deploy em produção: `https://anfitrioes.pt` ✅.

## Não incluído nesta fase (deliberado, não esquecido)
Eventos "cancelamento", "checkin amanhã", "checkout hoje", "pagamento em falta", etc. **não têm colunas de preferência ainda** porque a app não gera esses triggers de notificação ao anfitrião hoje — adicionar colunas sem trigger real seria especulativo. Ficam para quando o motor de automações (Fase 3, `SAAS_ARCHITECTURE.md` §9) os implementar.

## Próximo passo
Ver `TODO.md` → Fase 1.5 (confirmar Clerk JWT template + `MAINTENANCE_MODE`) antes de avançar para Fase 2 (templates de website).
