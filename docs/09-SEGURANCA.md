# Segurança — Índice

Estado atual e gaps: [`SAAS_ARCHITECTURE.md` §10](./SAAS_ARCHITECTURE.md#10-segurança).

## Checklist OWASP aplicado (auditoria contínua, não pontual)

| Risco OWASP | Mitigação no Anfitrião |
|---|---|
| Injection | Supabase client parametrizado (sem SQL concatenado); zero SQL raw no código de aplicação |
| Broken Access Control | RLS por `owner_id` + `canUpsertRow` (`lib/ownership.ts`) contra IDOR |
| Cryptographic Failures | Segredos em env vars (Vercel), nunca em código; TLS via Vercel/Cloudflare |
| SSRF | Allowlist de hosts no fetch de iCal (`lib/ical-fetch.ts`) |
| Mass Assignment | Whitelist de campos em `/api/book` (server força `estado`/`origem`/`owner_id`) |
| Rate limiting ausente | `lib/rate-limit.ts` em todas as rotas públicas |
| Secrets em rotas públicas | `CRON_SECRET` valida cron jobs; nenhuma rota pública dispara envio de email arbitrário (corrigido 2026-07-10, ver `PROGRESS.md`) |
| Autenticação fraca | Clerk (gestão de sessão, MFA disponível a ativar) |
| Logging/Monitorização insuficiente | 🔴 Gap — sem audit log genérico de ações administrativas (ver Fase 3, `SAAS_ARCHITECTURE.md` §10) |

## 2FA
Clerk suporta MFA nativamente (TOTP, SMS) — ativar via Clerk Dashboard é configuração, não desenvolvimento. Ação: ativar como opcional na Fase 1.5, obrigatório para papel `owner` na Fase 3 (junto com RBAC).

## Audit log
Gap real. Ação proposta: tabela `audit_log` (`owner_id`, `actor_id`, `acao`, `entidade`, `entidade_id`, `metadata jsonb`, `criado_em`) escrita a partir de um helper único chamado nas mutações sensíveis (billing, permissões, exclusão de propriedade). Não instrumentar tudo — só ações irreversíveis ou sensíveis a auditoria.
