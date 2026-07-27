# Anfitrião — Arquitetura Funcional e Técnica para SaaS Comercial

_Documento de arquitetura. Gerado em 2026-07-26. Substitui progressivamente `PRODUCAO.md` (desatualizado — já não reflete o estado real, ver secção 0)._

**Estado deste documento:** planeamento aprovado para execução faseada. Nenhum código foi alterado na sessão que o produziu — implementação começa depois, por fases, seguindo o roadmap (secção 12).

---

## 0. Onde estamos hoje (auditoria, não visão)

O `anfitriao` **não é um projeto novo** — é um PMS já em produção (`anfitrioes.pt`) com mais funcionalidade do que o `PRODUCAO.md` (2026-05-26) descreve. Este documento planeia a evolução a partir daqui, não do zero.

**Já implementado e validado em produção:**

| Área | Estado | Evidência |
|---|---|---|
| Multi-tenant auth | ✅ Clerk, `owner_id` em todas as tabelas | `007_accounts.sql`, `008_rls_owner_isolation.sql` |
| RLS isolamento por tenant | ✅ Hardened (2026-06-30), 0 ERROR no advisor | `PROGRESS.md` sessão 2026-06-30 |
| Billing/subscrições | ✅ Stripe (checkout, portal, webhook) | `src/app/api/stripe/*` |
| Gestão de propriedades multi-quarto | ✅ | `(app)/propriedades` |
| Calendário + reservas + conflitos | ✅ | `(app)/calendario`, `(app)/reservas` |
| Preços (regras, tarifas, plataformas) | ✅ | `(app)/precos` |
| Sincronização iCal (import + export) | ✅ Import anti-SSRF + **export por propriedade já existe** (`api/ical/[propertyId]`, UID hasheado por privacidade, exposto em `propriedades/[id]` e `website`) | `lib/ical-fetch.ts`, `lib/ical.ts`, `app/api/ical/[propertyId]/route.ts` |
| Site público por anfitrião | ⚠️ Existe mas é **1 página fixa, sem templates** | `app/r/[slug]`, `website_settings` (schema plano) |
| Check-in online + SIBA/SEF | ✅ CSV export, OCR de documentos | `(app)/documentos`, `api/siba-export`, `api/documentos/extrair` |
| Concierge IA multilingue | ✅ Claude via `@ai-sdk/anthropic` | `(app)/concierge` |
| Notificações email | ⚠️ Parcial (nova reserva server-side; check-in/pagamento têm rota mas dependem de `RESEND_API_KEY`) | `lib/notify-booking.ts` |
| Push notifications (PWA) | ✅ | `012_push_subscriptions.sql`, `lib/push.ts` |
| Admin/backoffice | ✅ básico | `(admin)/admin/contas` |
| CI/CD, testes (Vitest, 3 timezones) | ✅ | `PROGRESS.md` |

**Gaps reais face à visão pedida (é aqui que este documento foca esforço):**

1. **Nenhum sistema de templates** — 1 layout único, sem seleção visual, sem CMS de cores/fontes/secções.
2. **Channel Manager é só leitura (iCal one-way)** — sem push de disponibilidade/preço para Airbnb/Booking, sem API 2-way, sem Vrbo/Expedia/Google Vacation Rentals.
3. ~~CRM fraco~~ — **reavaliado (2026-07-26)**: `guests` já tem tags (vip/problemático/frequente/novo), notas e histórico de reservas visível em `hospedes/[id]`. Suficiente para este estágio; falta só campanhas/blacklist explícita se vier a ser pedido.
4. **Financeiro parcial** — `/relatorios` já tem ADR/RevPAR/CSV; **despesas/lucro implementado** (`/financeiro`, Fase 3). Falta: comissões detalhadas por plataforma, IVA, exportação PDF/Excel.
5. **Sem motor de automações** (regras "se X então Y").
6. **Sem centro de preferências de notificações** por utilizador.
7. ~~Clerk JWT template no Supabase~~ — **reavaliado (2026-07-26)**: `getSupabaseForRequest()`/RLS via JWT nunca foi ligado a nenhuma rota (código morto). O isolamento real é `service_role` + `.eq('owner_id', userId)` com `userId` vindo sempre de `auth()` server-side — auditado nas 20 rotas de API existentes, 100% consistente. Já não bloqueia lançamento; fica como melhoria de defesa em profundidade (Pendência §13).
8. ~~`MAINTENANCE_MODE`~~ — **confirmado `false` em produção** (2026-07-26, verificado por HTTP).

Este documento assume que se constrói **em cima** do que existe, não se reescreve.

---

## 1. Personas

### 1.1 Proprietário com 1 alojamento ("Sofia")
- Apartamento em Lisboa, gere sozinha ao fim do dia após o emprego.
- Dor: alternar entre Airbnb app, extranet Booking, WhatsApp e papel para SIBA.
- Precisa: ver hoje de relance, responder mensagens rápido, não pensar em faturação.
- Sucesso = "abro o telemóvel, vejo tudo, fecho em 2 minutos."

### 1.2 Proprietário com vários alojamentos ("Miguel", 4-8 unidades)
- Já pensa em ocupação e ADR, não só em "está reservado ou não".
- Dor: overbooking entre canais, preços desatualizados manualmente.
- Precisa: calendário consolidado, channel manager real, relatórios comparativos mês-a-mês.

### 1.3 Empresa de gestão de Alojamento Local (10-100 unidades, múltiplos proprietários-clientes)
- Gere propriedades de terceiros, precisa de fazer prestação de contas a cada dono.
- Dor: nenhuma ferramenta portuguesa faz split de comissões por proprietário nem relatórios white-label.
- Precisa: multi-conta (equipa), permissões por utilizador, relatórios por proprietário, faturação a proprietários.
- **Implicação de arquitetura:** o modelo de dados de "conta" tem de suportar hierarquia (empresa gestora → proprietários → propriedades), não só "1 conta = 1 dono".

### 1.4 Hotel Boutique / Hostel (10-40 quartos, unidade única com múltiplos tipos de quarto)
- Já usa PMS de hotel provavelmente inexistente ou Excel.
- Dor: gestão de tipologias de quarto, ocupação por quarto vs por unidade.
- Precisa: mapa de quartos tipo grelha (não lista), tarifação por tipo de quarto/ocupação (adultos/crianças).
- **Nota:** já suportado parcialmente (`005_rooms_support.sql`) — validar se cobre hostel (dormitórios/camas) ou só apartamentos com quartos.

### 1.5 Gestor de equipas (limpeza/manutenção)
- Não é o dono, é operacional. Acede só ao que precisa (tarefas de hoje, morada, checklist).
- Dor: recebe instruções por WhatsApp disperso, sem registo.
- Precisa: app simples com lista de tarefas do dia, sem acesso a financeiro/reservas.
- **Implicação:** RBAC com papel `staff`/`limpeza` — atualmente só existe o dono autenticado via Clerk; não há sub-utilizadores por conta.

---

## 2. Fluxos principais

### 2.1 Onboarding (novo cliente → primeira reserva)

```
Registo (Clerk)
  ↓
Escolha do plano (Grátis / Starter / Pro) → Stripe Checkout
  ↓
Wizard: nome do alojamento, tipo (apartamento/casa/hotel/hostel), nº propriedades
  ↓
Criação automática:
  - registo em `accounts`
  - propriedade inicial em `properties`
  - `website_settings` com slug único + template default
  - sitemap/robots/OG herdados do template (não precisam de novo código por tenant)
  ↓
Escolha de template (galeria visual, preview ao vivo)
  ↓
Personalização (logótipo, cores, fotos, textos) — CMS visual
  ↓
Publicação automática em `anfitrioes.pt/r/[slug]` (+ subdomínio em fase 2)
  ↓
Ligar canais: iCal Airbnb, iCal Booking (import já existe; export/push é gap, secção 5)
  ↓
Receção de reservas → `hoje` (dashboard operacional)
  ↓
Gestão diária (check-in, mensagens, limpeza)
  ↓
Relatórios mensais + automações ativas por defeito (lembrete check-in, pedido de avaliação)
```

Este fluxo já existe **do wizard até "ligar canais"**. O elo em falta é "escolha de template" — hoje não existe escolha, só um layout fixo.

### 2.2 Fluxo de reserva direta (hóspede)
Já implementado: `/r/[slug]` → `/book/[propertyId]` → `/api/book` (validado, rate-limited) → email de confirmação → aparece em `hoje`. Sem alterações estruturais necessárias, só extensão visual (templates).

### 2.3 Fluxo de channel manager (a construir)
```
Anfitrião muda preço/disponibilidade em Anfitrião
  ↓
Fila de sincronização (não pode ser síncrono — canais têm rate limits)
  ↓
Worker envia update para Airbnb/Booking via API oficial (quando disponível) ou iCal (só disponibilidade, não preço)
  ↓
Confirmação/erro registado em `sync_log`
  ↓
Notificação ao anfitrião se falha ("Erro Sincronização")
```
Airbnb e Booking.com **não têm API pública aberta para pequenos operadores** — o acesso real exige certificação como Channel Manager parceiro (processo de meses, due diligence). Isto é a decisão de negócio mais importante do roadmap — ver Pendências (secção 13).

### 2.4 Fluxo de automação (motor)
```
Trigger (evento: X dias antes do check-in | reserva criada | checkout hoje | pagamento em falta)
  ↓
Condição (propriedade = Y | plataforma = Z | valor > N)
  ↓
Ação (enviar email | enviar push | criar tarefa limpeza | marcar automático)
  ↓
Log de execução (auditável, visível ao anfitrião)
```

---

## 3. Arquitetura geral

### 3.1 Diagrama lógico (alvo)

```
                         ┌─────────────────────────┐
                         │   anfitrioes.pt (mkt)    │  Next.js — landing, pricing, blog
                         └────────────┬─────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
┌───────▼────────┐           ┌────────▼────────┐          ┌─────────▼─────────┐
│ app.anfitrioes.pt│           │ *.anfitrioes.pt │          │ Domínio próprio    │
│ Painel SaaS      │           │ Sites públicos  │          │ (CNAME, Pro/Elite) │
│ (Next.js, Clerk)  │           │ por tenant      │          │                    │
└───────┬────────┘           └────────┬────────┘          └─────────┬─────────┘
        │                             └──────────────┬───────────────┘
        │                                             │
┌───────▼─────────────────────────────────────────────▼────────┐
│                    API Layer (Next.js Route Handlers)          │
│  /api/book  /api/checkin  /api/stripe  /api/ical  /api/channel │
└───────┬───────────────────────────────────┬────────────────────┘
        │                                   │
┌───────▼────────┐                 ┌────────▼─────────┐
│ Supabase        │                 │ Fila de jobs      │
│ Postgres + RLS  │                 │ (sync canais,     │
│ Storage         │                 │  emails, cron)     │
└─────────────────┘                 └────────────────────┘
        │
┌───────▼──────────────────────────────────────────┐
│ Integrações externas: Clerk · Stripe · Resend ·   │
│ web-push · Anthropic Claude · iCal (Airbnb/Booking)│
│ · (futuro) Booking Connectivity API · Vrbo API     │
└─────────────────────────────────────────────────────┘
```

### 3.2 Decisão: manter monólito Next.js modular, não microserviços

Com centenas/milhares de tenants em RLS multi-tenant Postgres, **não há razão para microserviços agora**. Lodgify, Smoobu e Hospitable começaram e escalaram em arquiteturas monolíticas modulares durante anos. A complexidade operacional de microserviços não se paga antes de ~50-100k utilizadores ativos. Reavaliar apenas se: (a) o worker de sincronização de canais precisar de escala independente do resto, ou (b) equipa crescer para múltiplas squads.

**Único componente que deve ser extraído desde já:** o **worker de sincronização de canais** (jobs assíncronos, retries, rate-limit por canal) — não cabe bem no modelo request/response de Route Handlers. Ver secção 5.

---

## 4. Stack tecnológico

| Camada | Escolha | Justificação |
|---|---|---|
| Frontend/Backend | **Next.js 16 (App Router) — já em uso** | Manter. Trocar framework agora destruiria 12 migrations e meses de trabalho validado para zero ganho mensurável. |
| Base de dados | **Supabase Postgres — já em uso** | RLS nativo é exatamente o mecanismo de isolamento multi-tenant certo; já hardened. |
| Auth | **Clerk — já em uso** | Suporta organizações (`Clerk Organizations`) — resolve a persona 1.3 (empresa gestora com sub-contas) **sem migração de auth**, só ativar o produto Organizations. |
| Billing | **Stripe — já em uso** | Suporta metered billing, múltiplos planos, e faturação B2B (persona 1.3) via Stripe Connect se necessário no futuro. |
| Filas/Jobs assíncronos | **Novo: Supabase `pg_cron` + tabela de jobs, ou Trigger.dev/Inngest** | Para sync de canais e automações. `pg_cron` chega até escala média (milhares de tenants); Inngest/Trigger.dev se precisar de retries complexos e observabilidade dedicada. Decisão adiada para Fase 2 (secção 12) — não bloqueia o resto. |
| Storage | **Supabase Storage + Vercel Blob (já em uso para documentos)** | Manter dois por agora; consolidar em Supabase Storage quando o custo do Vercel Blob a volume justificar migração. |
| Email | **Resend — já em uso** | Suficiente até volume alto; API simples, boa entregabilidade. |
| IA | **Anthropic Claude via Vercel AI SDK — já em uso** | Concierge multilingue já funcional; reutilizar para automações de texto (respostas sugeridas, extração de dados). |
| Hosting | **Vercel — já em uso** | Wildcard subdomain e custom domains exigem plano Pro (já identificado no `PRODUCAO.md`). |
| Templates de website | **Novo: sistema de temas via JSON config + componentes React parametrizados** (não builder drag-drop livre) | Um website builder livre (tipo Wix) é ordens de magnitude mais caro de construir e manter do que temas parametrizados com secções ligar/desligar. Ver secção 6. |

**Não introduzir:** GraphQL (Route Handlers REST-like já servem bem), microserviços, base de dados separada por tenant (RLS já resolve isolamento a custo muito menor), CMS externo (Contentful/Sanity — dados vivem melhor no mesmo Postgres, com RLS, do que separados).

---

## 5. Channel Manager — arquitetura e realidade

**Isto é o risco técnico-comercial nº1 do roadmap e precisa de ser dito com clareza:**

- **iCal** (já implementado, import): só sincroniza disponibilidade, não preços, com atraso de minutos a horas, sem prevenção real de overbooking em tempo real. É o que 90% dos PMS pequenos usam de facto para Airbnb/Booking porque é o que está acessível sem parceria.
- **Airbnb API**: fechada. Só disponível a parceiros certificados (processo de aplicação, volume mínimo, due diligence).
- **Booking.com Connectivity API**: idem — exige ser "Connectivity Partner", processo formal.
- **Vrbo/Expedia**: via Expedia Partner Central, também requer parceria.
- **Google Vacation Rentals**: requer feed estruturado e aprovação Google.

**Arquitetura recomendada (faseada, não bloqueante):**

1. ~~Fase 2: export iCal por propriedade~~ — **já implementado** (`/api/ical/[propertyId]`), correção face à versão anterior deste documento que o listava como gap. O ciclo básico (import + export) está fechado.
2. **Fase 3:** camada de abstração `ChannelAdapter` (interface comum: `pushAvailability`, `pushRate`, `pullReservations`) com uma implementação `ICalAdapter` já pronta e stubs para `AirbnbAdapter`/`BookingAdapter`.
3. **Fase 4 (decisão de negócio, não técnica):** candidatar a empresa a parceiro Booking Connectivity / Airbnb API assim que houver volume de clientes que o justifique (tipicamente exigem base de clientes mínima). Até lá, ser transparente no produto: "sincronização em minutos via iCal", nunca prometer tempo real.

Prevenção de overbooking **não depende de API 2-way**: já é possível e deve ser prioritário — validação de conflito local (já existe, calendário) + polling iCal mais frequente + bloqueio automático de datas com aviso ao anfitrião em caso de conflito detetado.

---

## 6. Sistema de Templates & Website Builder

### 6.0 Correção (2026-07-26): `cor_primaria` já existia, só não estava ligada
Auditoria encontrou que `website_settings.cor_primaria`/`cor_secundaria` já existiam (migration `website_settings_email_identity`, aplicada em produção mas ausente do histórico local — ver nota de drift em `docs/18-MANUAL-TECNICO.md`) e já eram usadas para branding de email (`lib/email/identity.ts`), com UI de seleção já em `(app)/website`. Não estavam a ser aplicadas ao próprio site público. Corrigido: `/r/[slug]` agora aplica `cor_primaria` como override da variável CSS `--primary` (validada por regex hex, com fallback seguro ao tema default). `/book/[propertyId]` (fluxo de reserva client-side) ainda não tema — próximo passo imediato, não requer nova migração, só propagar a mesma lógica aos client components `BookingClient`/`RoomsClient`.

### 6.1 Modelo de dados (novo)

```sql
-- Catálogo de templates (gerido pela equipa Anfitrião, não pelo cliente)
create table website_templates (
  id text primary key,              -- 'modern', 'luxury', 'rural', ...
  nome text not null,
  categoria text not null,          -- 'apartamento','rural','hotel','hostel',...
  preview_image_url text,
  config_schema jsonb not null,     -- secções disponíveis, campos editáveis
  ativo boolean default true
);

-- Substituir website_settings plano por uma versão com tema
alter table website_settings
  add column template_id text references website_templates(id) default 'modern',
  add column theme jsonb default '{}',   -- {cor_primaria, fonte, ...}
  add column secoes jsonb default '{}',  -- {sobre: {ativo:true, texto:...}, galeria:{...}, faq:[...]}
  add column idioma_default text default 'pt';
```

Cada template é um **conjunto de componentes React já existentes na app**, parametrizados por `theme` + `secoes`. Não se escreve HTML por tenant — escreve-se 8-12 templates uma vez, o cliente escolhe e ajusta JSON via UI, o motor de render é único.

### 6.2 Páginas por site (todas via um único router `[slug]/[page]`, gap face ao pedido)
Hoje só existe a página inicial do `/r/[slug]`. Faltam como sub-rotas do mesmo tenant: Sobre, Alojamentos, Galeria, Localização, Serviços, FAQ, Blog, Privacidade/Cookies/Termos. Todas renderizáveis a partir de `secoes` + conteúdo — **sem necessidade de nova infraestrutura**, só novos componentes de secção e rotas dinâmicas.

### 6.3 SEO automático por site
Já existe OG dinâmico e robots/sitemap para o domínio principal; estender o mesmo padrão (`api/og`, `sitemap.ts`) para gerar sitemap **por tenant** (`/r/[slug]/sitemap.xml`) e Schema.org `LodgingBusiness`/`Hotel` a partir dos dados já existentes em `properties`/`website_settings` — dados estruturados quase de graça porque a informação já está na base de dados.

---

## 7. Estrutura de dados — extensões necessárias

Tabelas já existentes (properties, bookings, guests, tarifas, price_rules, platform_rates, price_change_log, website_settings, accounts, push_subscriptions) mantêm-se. Novas tabelas propostas:

| Tabela | Propósito |
|---|---|
| `website_templates` | Catálogo de templates (secção 6) |
| `channel_connections` | Ligações por propriedade/canal (tipo, credenciais/feed URL, estado) |
| `sync_log` | Histórico de sincronizações (canal, resultado, erro) |
| `notification_preferences` | Por utilizador: que eventos, que canal (push/email/in-app) |
| `automations` | Regras trigger → condição → ação, por conta |
| `automation_log` | Execuções de automações (auditoria) |
| `guest_notes` | CRM: notas por hóspede |
| `guest_tags` | CRM: preferências/etiquetas |
| `expenses` | Financeiro: despesas por propriedade |
| `team_members` | RBAC: sub-utilizadores por conta (papel: owner/manager/staff/limpeza) — depende de Clerk Organizations (secção 4) |
| `cleaning_tasks` | Limpeza/manutenção: tarefas por reserva/propriedade, atribuídas a `team_members` |

Todas seguem o padrão já estabelecido: `owner_id` obrigatório, RLS via `requesting_owner_id()`, sem exceções.

---

## 8. RBAC e permissões (novo)

Hoje: 1 utilizador Clerk = 1 conta = acesso total. Não serve a persona 1.3 (empresa gestora) nem 1.5 (equipa de limpeza).

**Solução:** ativar **Clerk Organizations**. Cada `account` mapeia para uma Organization Clerk. Papéis:
- `owner` — acesso total, financeiro, billing.
- `manager` — reservas, propriedades, preços, sem billing/financeiro sensível.
- `limpeza`/`manutencao` — só `cleaning_tasks` do dia, morada, checklist. Sem ver preços/hóspedes financeiro.

RLS estende-se com `requesting_role()` além de `requesting_owner_id()`, ambos derivados do JWT Clerk.

---

## 9. Dashboard, KPIs, Financeiro, CRM, Automações — resumo funcional

Não são gaps de arquitetura, são gaps de **superfície de produto** sobre dados que já existem ou são extensões diretas das tabelas da secção 7:

- **KPIs** (ocupação, ADR, RevPAR, receita/despesa, comparativos): calculáveis a partir de `bookings` + `expenses` (nova). Implementar como queries agregadas + cache leve (materialized view ou cron diário), não em tempo real pesado.
- **CRM**: `guests` já existe; adicionar `guest_notes`/`guest_tags` e uma vista agregada "histórico do hóspede" (reservas passadas, mensagens, notas).
- **Financeiro**: `expenses` nova; exportação Excel/PDF usa dados já normalizados — biblioteca de export (`xlsx`/PDF) sem necessidade de serviço externo.
- **Automações**: motor genérico (`automations` + `automation_log`) executado por cron; reaproveita `lib/notify-booking.ts`/`notify-checkin.ts` já existentes como "ações" do motor em vez de criar novo sistema de envio.
- **Notificações**: `notification_preferences` + os 3 canais já existentes tecnicamente (push via `lib/push.ts`, email via Resend, in-app via toast/sonner já em uso) — falta só a UI de preferências e o roteamento por preferência em vez de hardcoded.

---

## 10. Segurança

| Medida | Estado |
|---|---|
| RBAC | 🔴 A construir (secção 8) |
| RLS por tenant | ✅ Hardened |
| Rate limiting | ✅ Rotas públicas (`lib/rate-limit.ts`) |
| Anti-SSRF (iCal) | ✅ |
| Anti-mass-assignment (`/api/book`) | ✅ |
| CSP headers | ✅ |
| 2FA | 🔴 A avaliar — Clerk suporta nativamente, é "ligar", não construir |
| Auditoria (quem fez o quê) | 🟡 Parcial (`automation_log`/`sync_log` cobrem automações; falta log genérico de ações administrativas) |
| Backups | 🟡 Confirmar plano Supabase (backups diários exigem Pro — já referido em `PRODUCAO.md` Fase 2) |
| Segredos/CRON_SECRET | ✅ |
| OWASP geral | ✅ Práticas presentes (validação, clamps, whitelists) — manter disciplina em código novo |

**Nada aqui exige nova arquitetura de segurança** — é continuar o padrão já estabelecido (RLS + service_role em API routes + validação server-side) para cada tabela/rota nova.

---

## 11. Escalabilidade — 100 → 100.000 clientes

O modelo RLS multi-tenant num único Postgres Supabase **escala nativamente até dezenas de milhares de tenants** sem reescrita, desde que:

1. Índices em `owner_id` em todas as tabelas com filtro por tenant (verificar nas migrations existentes; adicionar onde faltar).
2. Queries agregadas pesadas (KPIs, relatórios) não corram em tempo real acima de ~5-10k tenants — passar a materialized views refrescadas por cron.
3. Sync de canais e envio de emails/automações correm em worker assíncrono (secção 3.2), não bloqueiam requests.
4. Supabase Pro → escalões superiores (compute add-ons) conforme volume; não é um limite arquitetural, é um dial de custo.
5. Vercel escala automaticamente (serverless); o único ponto de atenção é function duration em rotas de sync/export pesado — mover para background job antes de bater timeout.

**Não há necessidade de sharding, multi-região ativa-ativa, ou separação de base de dados por tenant** em nenhum destes patamares. Reavaliar apenas acima de ~100k tenants ou requisitos de residência de dados por país.

---

## 12. Roadmap

### Fase 1.5 — Fechar fundação antes de abrir a mais clientes (curto prazo)
- [ ] Confirmar/ativar Clerk JWT template no Supabase (bloqueia RLS client-side real — crítico, já no backlog)
- [ ] Confirmar `MAINTENANCE_MODE=false` em produção
- [ ] Testar fluxo completo onboarding ponta-a-ponta em produção

### Fase 2 — Templates + fecho do channel manager (maior valor/esforço)
- [ ] `website_templates` + `theme`/`secoes` em `website_settings`
- [ ] 4-6 templates iniciais (não os 12 todos de uma vez — validar com clientes reais primeiro)
- [ ] Páginas adicionais do site por tenant (Sobre, Galeria, FAQ, etc.) via secções configuráveis
- [ ] Sitemap/Schema.org por tenant

### Fase 3 — Operação e retenção
- [~] RBAC (Clerk Organizations) — **adiado (decisão 2026-07-26)**: sem prospect real de empresa de gestão a justificar o esforço; revisitar quando houver procura confirmada — ver `TODO.md`
- [x] CRM básico já existia (tags/notas/histórico); campanhas/blacklist explícita ficam para quando houver procura
- [ ] Motor de automações + `notification_preferences` (UI + roteamento)
- [ ] Financeiro (`expenses`, exportação Excel/PDF, relatórios de comissões/IVA)
- [ ] Worker assíncrono dedicado (jobs de sync/automação) — decisão `pg_cron` vs Inngest/Trigger.dev

### Fase 4 — Crescimento e canais reais
- [ ] Wildcard subdomínio `*.anfitrioes.pt` + custom domain (Vercel Pro — já orçamentado em `PRODUCAO.md`)
- [ ] `ChannelAdapter` (interface comum) + candidatura formal a Booking Connectivity Partner / Airbnb API quando o volume de clientes justificar
- [ ] Multi-idioma (PT/EN) nos sites de clientes
- [ ] Dashboard super-admin multi-tenant

Cada fase é **shippable independentemente** — nenhuma bloqueia lançamento comercial no plano atual (single-property/pequenos operadores já é vendável hoje, mesmo sem templates, se aceitável ao mercado-alvo inicial).

---

## 13. Pendências para Validação Humana

Decisões de negócio que precisam da tua aprovação — desenvolvimento não para por causa delas, mas nenhuma implementação irreversível avança sem resposta:

1. **Prioridade de fase**: começar por Templates (mais visível/vendável) ou por Channel Manager export iCal (mais crítico operacionalmente, evita overbooking)? Recomendação: iCal export primeiro (menor esforço, resolve dor real), templates a seguir.
2. **Modelo de planos/preços**: `PRODUCAO.md` sugere Grátis/€15/€25; confirmar se ainda é o alvo ou se mudou com o billing Stripe já implementado (verificar Price IDs atuais em produção).
3. ~~Persona empresa gestora (1.3): RBAC já ou adiar?~~ — **decidido (2026-07-26): adiado.** Sem prospect real, o custo (mudança de arquitetura em auth + todas as RLS + UI nova) não se justifica para os clientes atuais (proprietário 1/multi-alojamento, já servidos pelo modelo 1-conta-1-dono). Não fecha portas — revisitar quando surgir procura confirmada.
4. **Candidatura a Airbnb API / Booking Connectivity Partner**: processo de negócio (não técnico) com requisitos de volume — decidir quando abrir esse processo.
5. **Domínio `anfitriao.pt` vs `anfitrioes.pt`**: `PRODUCAO.md` refere `anfitriao.pt` como alvo mas produção já está em `anfitrioes.pt` — confirmar qual é definitivo antes de configurar wildcard subdomain (Fase 4).
6. **Orçamento para Vercel Pro / Supabase Pro** — necessário para wildcard subdomain, backups diários e connection pooling (Fase 2/4); custos já estimados em `PRODUCAO.md`.

---

## 14. Benchmark — posicionamento

| Concorrente | Ponto forte | Ponto fraco | Como o Anfitrião se diferencia |
|---|---|---|---|
| Lodgify | Website builder maduro | Genérico, não português, caro para 1 propriedade | Templates simples + SIBA/SEF nativo (nenhum concorrente internacional faz isto) |
| Guesty/Hostaway | Channel manager robusto, API real com canais | Complexo, pensado para gestores grandes, preço elevado | Simplicidade radical (3 cliques), preço acessível a 1 propriedade |
| Smoobu | Preço baixo, multi-canal | UI datada, suporte fraco em PT | UX moderna (Airbnb/Stripe/Linear como referência), copy em português real |
| OwnerRez/Hospitable | Automação de mensagens forte | Sem foco em compliance local | Concierge IA + SIBA/SEF automático como diferenciador de compliance |
| Airbnb/Booking (extranet) | Distribuição, confiança do hóspede | Não é ferramenta de gestão, comissão alta | Anfitrião não compete com a distribuição — potencia reservas diretas com 0% comissão |

**Posicionamento:** não competir em amplitude de canais (Guesty/Hostaway já venceram essa corrida para operadores grandes) — competir em **simplicidade + compliance português + reservas diretas sem comissão**, que nenhum concorrente internacional oferece nativamente.

---

_Próximo passo: aprovar prioridade de fase (Pendência 1) e iniciar implementação faseada. Este documento deve ser atualizado a cada fase concluída, como o `PROGRESS.md`._
