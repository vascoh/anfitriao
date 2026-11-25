# Anfitrião — Handoff

_Última atualização: 2026-11-25_ · O histórico detalhado de sessões vive em `PROGRESS.md`;
o que falta e porquê está em `TODO.md` e em `docs/PLANO-EVOLUCAO-2026-11.md`.

---

## Estado do projeto

PMS para Alojamento Local português, em produção em **https://anfitrioes.pt**
(multi-tenant via Clerk). Posicionamento decidido a 2026-11-16: **«A tua conformidade,
com prova»**: cada envio ao SIBA fica registado com SHA-256 e resposta, e entra no
dossiê ASAE.

- Uso real: uma conta (Casa de Vasco, Pro) com 4 alojamentos e reservas a entrar por
  iCal. Ainda **0 boletins SIBA entregues por web service**: falta a credencial (H1).
- Contas novas entram na app (os E2E em produção usam utilizadores Clerk descartáveis
  desde outubro). `MAINTENANCE_MODE` existe nas variáveis de produção e continua a ser o
  interruptor para fechar a app a todos exceto ao admin (`src/proxy.ts`).
- Trial de **30 dias** (migração 060) e preço garantido enquanto a subscrição estiver ativa.
- IA desligada por decisão do Vasco (2026-10-09, sem crédito Anthropic):
  `NEXT_PUBLIC_IA_ATIVA` falso por omissão (`lib/ia.ts`). Sugestões, Concierge e leitura de
  documentos ficam escondidos e as rotas devolvem 503. Para religar: env `true` e deploy.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16.4 (webpack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI) |
| Testes | Vitest (`npm test`, ~1490 testes, têm de passar em qualquer timezone); Playwright + axe para E2E ad hoc |
| Auth | Clerk (**ainda em instância de desenvolvimento**: pendente 0.2) |
| Base de dados | Supabase Postgres `nnbqfrszukkzoqwssjvg` (eu-west-1), partilhado com `cryptobot.*` e `blocos_pages` |
| Agendamento | Vercel Cron (diário, limite Hobby) **e** pg_cron do Supabase (iCal de 15 em 15 min, alertas de canais de hora a hora) |
| Notificações | Resend (email) + web-push/VAPID (push PWA) |
| Pagamentos | Stripe (subscrições Starter 19 €, Pro 39 €, Empresa) |
| Faturação | InvoiceXpress (chave de parceiro; contas próprias ligáveis) |
| Erros | Sentry ligado no código, inerte até haver `SENTRY_DSN` (0.4) |
| Deploy | Vercel, projeto `anfitriao`, scope `vascotelo-7402s-projects` |

---

## Arquitetura (resumo)

```
src/
  app/
    page.tsx · vs/ · (legal)/   # landing, comparações, páginas legais
    (app)/                      # app autenticada: hoje, reservas, hospedes, propriedades,
                                # calendario, canais, mensagens, limpezas, precos,
                                # financeiro, faturacao, conformidade, relatorios,
                                # automacoes, website, blog, conta, documentos, concierge
    (admin)/                    # painel admin (funil de ativação, contas)
    (auth)/                     # sign-in / sign-up Clerk
    r/[slug]/ · book/           # site de reservas diretas e checkout do hóspede (públicos)
    checkin/ · equipa/          # check-in online do hóspede; acesso da equipa de limpeza
    api/                        # rotas; cron/* chamado pela Vercel e pelo pg_cron
  lib/                          # lógica de domínio testada (ical-*, siba, ine, fiscal-irs,
                                # dossie-asae, canais*, limpezas, mensagens, faturacao, …)
  proxy.ts                      # middleware Clerk: lista única de rotas públicas,
                                # manutenção, enforcement de estado/trial
supabase/migrations/            # 001–062 (as migrações não são a fonte de verdade do
                                # schema antigo; ver PROGRESS)
```

---

## Tenancy e segurança

```
Browser ── só rotas /api ──▶ Next (service_role, filtra por owner_id) ──▶ Supabase
Páginas públicas /book ──▶ anon key ──▶ Supabase RLS (políticas anon mínimas)
```

- **Todo o acesso autenticado passa por rotas API com `service_role`**, que filtram por
  `owner_id`. Upserts com o admin client passam por `canUpsertRow` (`lib/ownership.ts`)
  para evitar IDOR. Escrever sempre `owner_id`.
- A wiring de RLS client-side com JWT do Clerk foi **removida** (código morto desde junho;
  ver PROGRESS, setembro). O template JWT do Clerk deixou de ser requisito de lançamento.
  Ativá-lo seria só defesa em profundidade e implica voltar a criar um user client.
- As tabelas novas têm RLS ligado e nenhuma política (deny-all para anon/authenticated).
  O advisor do Supabase reporta-as como `INFO`: é intencional.
- Rotas públicas: lista única em `src/proxy.ts`; tudo o resto é privado por omissão.
  As públicas têm rate limit persistente (`verificarLimite`,
  `lib/rate-limit-persistente.ts`) e validação com clamps.
- iCal externo só via `lib/ical-fetch.ts` (allowlist anti-SSRF).
- Dados sensíveis dos hóspedes (documento) cifrados com `APP_ENCRYPTION_KEY`
  (`lib/crypto.ts`, `lib/campos-sensiveis.ts`).
- Avisos do advisor fora do anfitrião: `pg_net` em `public` (pg_cron depende dele) e as
  funções SECURITY DEFINER `cryptobot_*` (do projeto cryptobot).

---

## Agendamentos

| Onde | Job | Frequência |
|---|---|---|
| pg_cron | `anfitriao-ical-sync` → `/api/ical-sync` (segredo Vault `anfitriao_cron_externo` = `CRON_SECRET_EXTERNO`) | 15 min |
| pg_cron | `anfitriao-canais-alertas` → `/api/cron/canais-alertas` | de hora a hora, 07:30–21:30 UTC |
| Vercel Cron | retenção, ical-sync (rede de segurança), canais-alertas, faturação, automações, lembretes de pagamento e de trial, alertas de conformidade, noites órfãs (semanal), relatório mensal | ver `vercel.json` |

Verificar: `cron.job_run_details` e `net._http_response` no Supabase.

---

## Variáveis de ambiente

Lista completa e comentada em `.env.example`. Em produção faltam, de propósito ou à
espera de ação humana:

| Variável | Porque falta |
|---|---|
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Conta Sentry por criar (0.4) |
| `NEXT_PUBLIC_IA_ATIVA` | IA desligada por decisão (sem crédito Anthropic) |
| `INBOUND_EMAIL_DOMAIN`, `RESEND_WEBHOOK_SECRET` | Receção de respostas por email: MX + webhook no Resend |
| `STRIPE_EMPRESA_PRICE_ID` | Plano Empresa sem preço criado no Stripe |
| `INVOICEXPRESS_PARTNER_ACCOUNT` | **Não definir** enquanto o Amenitiz faturar a Casa de Vasco (dupla faturação à AT) |

O `.env.local` não tem `SUPABASE_SERVICE_ROLE_KEY` (é *sensitive* na Vercel) e tem
`MAINTENANCE_MODE="true"`: a app local não lê dados. Para E2E com dados usar uma
pré-visualização (ver `CLAUDE.md`).

---

## Pendentes que não são de código (Vasco)

| # | O quê |
|---|---|
| H1 | Credenciais SIBA em modo Web Service, por alojamento (validar primeiro em `/bawsdev/` via `SIBA_WS_URL`) |
| 0.2 / 0.6 | Clerk em instância de produção + MFA; PITR e restauro de ensaio. Até lá a produção mostra `x-clerk-auth-reason: dev-browser-missing` e a CSP permite `*.clerk.accounts.dev` |
| 0.4 | `SENTRY_DSN` |
| 0.7 / H4 | Vercel Pro antes do primeiro cliente pagante (Hobby é uso não comercial) |
| 2.6 | Decidir se `/r/[slug]` passa a indexável |
| H6 | Revisão jurídica (termos, privacidade, garantia) antes de cobrar |
| — | Importar no Amenitiz o feed das reservas diretas (`?origem=diretas`): `/canais` avisa que ainda não é lido |

---

## Deploy

1. `npm run typecheck && npm run lint && npm test && npm run build` (o build falha com
   `SecurityFatalError` se o Next tiver vulnerabilidades conhecidas: atualizar, não contornar).
2. `npx vercel deploy --prod --scope vascotelo-7402s-projects` (em background; >5 min).
3. Confirmar com `npx vercel inspect https://anfitrioes.pt` que a data de criação é a de
   agora. Nunca promover um URL antigo.
4. Verificar produção (HTTP das páginas públicas, Playwright mobile/desktop, axe) e
   registar o `dpl_…` no `PROGRESS.md`.

Dependências: usar `npx -y npm@11.19.0 …` (o npm 10 local rebenta e outros npm 11
geram lockfiles que a CI recusa). Sem `npm audit fix --force`.
