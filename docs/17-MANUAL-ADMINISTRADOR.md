# Manual do Administrador (equipa Anfitrião)

## Acessos
| Serviço | Onde | Nota |
|---|---|---|
| Vercel | vercel.com/vascotelo-7402s-projects/anfitriao | Deployments, env vars, domínios |
| Supabase | supabase.com, projeto `nnbqfrszukkzoqwssjvg` | Base de dados, advisor de segurança, backups |
| Clerk | dashboard.clerk.com | Utilizadores, JWT templates, MFA |
| Stripe | dashboard.stripe.com | Planos, Price IDs, faturas |
| Resend | resend.com | Emails transacionais |

## Backoffice interno
`(admin)/admin/contas` — gestão de contas de clientes. Expandir nas fases seguintes com: dashboard super-admin (todas as contas, MRR, churn), suporte (impersonar conta para diagnóstico), moderação de conteúdo de sites de tenants.

## Deploy
```bash
npm test && npm run typecheck && npm run lint && npm run build
npx vercel deploy --prod
```
Auto-deploy GitHub→Vercel está desligado deliberadamente — deploy é sempre manual e validado localmente primeiro.

## Migrações de base de dados
`supabase/migrations/*.sql`, numeradas sequencialmente. Nunca editar uma migration já aplicada em produção — criar sempre a próxima.

## Rotina de segurança periódica
Correr o advisor de segurança Supabase (`get_advisors`) após qualquer alteração de RLS ou tabela nova. Documentar o resultado em `PROGRESS.md`, seguindo o padrão já usado nas sessões de 2026-06-30.
