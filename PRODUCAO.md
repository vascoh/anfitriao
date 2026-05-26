# Anfitrião — Plano de Produção

_Documento gerado em 2026-05-26_

---

## Estado actual

A aplicação está **deployed e funcional** em:
- **Painel de gestão**: https://anfitriao-nine.vercel.app/hoje
- **Site de reservas (Vasco)**: https://anfitriao-nine.vercel.app/r/casadevasco

É uma aplicação **single-tenant** — existe um único anfitrião (Vasco) mas toda a arquitectura de dados já está preparada para multi-tenant.

---

## As duas aplicações

### 1. Anfitrião — Painel SaaS
Onde anfitriões se autenticam e gerem os seus alojamentos.

| | Agora | Com domínio |
|---|---|---|
| URL | `anfitriao-nine.vercel.app` | `app.anfitriao.pt` |
| Acesso | Apenas utilizadores autenticados (Clerk) | Idem |
| Função | Gestão de propriedades, reservas, hóspedes, preços, relatórios | Idem |

### 2. Site de reservas (por anfitrião)
O site público onde os hóspedes fazem reservas directas.

| | Agora | Com domínio | Fase 2 |
|---|---|---|---|
| URL | `anfitriao-nine.vercel.app/r/casadevasco` | `anfitriao.pt/r/casadevasco` | `casadevasco.anfitriao.pt` |
| Acesso | Público (sem login) | Idem | Idem |
| Função | Listagem de propriedades, calendário, formulário de reserva | Idem | Idem + branding por subdomínio |

---

## Arquitectura técnica

### Stack
| Componente | Tecnologia | Plano actual | Custo |
|---|---|---|---|
| Frontend + Backend | Next.js 16 / React 19 | Vercel Hobby | €0/mês |
| Base de dados | Supabase (Postgres) | Free tier | €0/mês |
| Autenticação | Clerk | Free (<10K MAU) | €0/mês |
| Email | Resend | Free (<3K/mês) | €0/mês |
| Domínio | — | Não comprado | ~€10/ano |
| **Total actual** | | | **~€0/mês** |

### Multi-tenancy (já implementado na base de dados)
Todas as tabelas têm uma coluna `owner_id` (= Clerk userId do anfitrião). O teu `owner_id` é `user_3DrUZjHebFBKAawGzhOfGzwwel6`.

O `website_settings` tem um `slug` único por anfitrião (o teu é `casadevasco`), que define o URL do site de reservas.

Quando um segundo anfitrião se registar:
1. Os seus dados ficam isolados pelo `owner_id`
2. Recebe um slug único → o seu site fica em `/r/[slug]`

---

## Custos por fase

### Fase 1 — Produção single-tenant (agora, só tu)

| Item | Fornecedor | Custo |
|---|---|---|
| Hosting (app + site reservas) | Vercel Hobby | €0/mês |
| Base de dados | Supabase Free | €0/mês |
| Autenticação anfitriões | Clerk Free | €0/mês |
| Email transaccional | Resend Free | €0/mês |
| Domínio `anfitriao.pt` | Cloudflare Registrar | ~€10/ano |
| **Total** | | **~€1/mês** |

### Fase 2 — Multi-tenant (3–20 anfitriões)

| Item | Fornecedor | Custo | Porquê |
|---|---|---|---|
| Hosting | Vercel Pro | €20/mês | Custom domains + wildcard subdomínio |
| Base de dados | Supabase Pro | €25/mês | Connection pooling, 8GB storage, backups diários |
| Autenticação | Clerk Free → Growth | €0–25/mês | Free até 10K MAU |
| Email | Resend Starter | €20/mês | Até 50K emails/mês |
| **Total** | | **€45–90/mês** | |

**Break-even**: 3 anfitriões a €20/mês cobrem a infra (€60 > €45).

### Fase 3 — SaaS escala (20+ anfitriões)

| Item | Custo estimado |
|---|---|
| Vercel Pro | €20/mês (fixo) |
| Supabase Pro | €25/mês (fixo) |
| Clerk Growth | €25+/mês (por MAU acima de 10K) |
| Resend | €20–100/mês (volume) |
| **Total infra** | **€70–170/mês** |
| Receita (20 × €20) | €400/mês |
| **Margem** | **€230–330/mês** |

---

## O que fazer agora — passos manuais

### Passo 1: Comprar o domínio (5 min)
1. Vai a [cloudflare.com/registrar](https://www.cloudflare.com/products/registrar/)
2. Regista `anfitriao.pt`
3. Custo: ~€10/ano (Cloudflare cobra a preço de custo, sem margem)

> **Alternativa**: Se `anfitriao.pt` não estiver disponível, considera `anfitriao.app`, `anfitriao.io` ou `anfitriaolocal.pt`.

---

### Passo 2: Criar instância Clerk de produção (15 min)
1. Vai a [dashboard.clerk.com](https://dashboard.clerk.com)
2. Cria uma nova **Application** (ou usa a existente)
3. Em **Domains** adiciona:
   - `app.anfitriao.pt` (painel de gestão)
4. Copia as chaves de **produção**:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → começa com `pk_live_`
   - `CLERK_SECRET_KEY` → começa com `sk_live_`

> As chaves actuais começam com `pk_test_` / `sk_test_` — não usar em produção.

---

### Passo 3: Configurar Vercel (10 min)
1. Vai ao [dashboard.vercel.com](https://vercel.com/dashboard) → projecto `anfitriao`
2. **Settings → Domains** → Adiciona:
   - `anfitriao.pt`
   - `app.anfitriao.pt`
3. **Settings → Environment Variables** → Actualiza:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = a chave `pk_live_` copiada no passo 2
   - `CLERK_SECRET_KEY` = a chave `sk_live_` copiada no passo 2
4. **Deployments** → Faz redeploy do último deployment para activar as novas variáveis

---

### Passo 4: Configurar DNS no Cloudflare (5 min)
No painel do Cloudflare para `anfitriao.pt`:

| Tipo | Nome | Valor | Proxy |
|---|---|---|---|
| CNAME | `@` (raiz) | `cname.vercel-dns.com` | ✅ Sim |
| CNAME | `app` | `cname.vercel-dns.com` | ✅ Sim |

> O Vercel verifica o domínio automaticamente após o DNS propagar (~5 min com Cloudflare).

---

### Passo 5: Actualizar URL do site de reservas no perfil
Após o domínio estar activo, o teu site de reservas estará em:
```
https://anfitriao.pt/r/casadevasco
```
Partilha este link com os teus hóspedes e coloca no Airbnb/Booking como "Website do anfitrião".

---

## Roadmap técnico

### Fase 1 ✅ Feito
- [x] Aplicação funcional e deployada
- [x] Multi-room support (Casa de Vasco com 3 quartos)
- [x] Calendário de reservas com bug corrigido
- [x] Sistema de preços (regras, tarifas, plataformas)
- [x] iCal sync (Airbnb, Booking.com, etc.)
- [x] Emails transaccionais (confirmação, lembretes, checkin)
- [x] Check-in online para hóspedes
- [x] Site de reservas por anfitrião (`/r/[slug]`)
- [x] Foundation multi-tenancy (`owner_id` em todas as tabelas)
- [x] Dark mode, PWA, loading skeletons
- [x] CI/CD (GitHub Actions)

### Fase 1.5 — Antes de abrir a outros anfitriões (código)
- [ ] Supabase + Clerk JWT integration (RLS por `owner_id`)
- [ ] Admin dashboard filtrado por `owner_id` (hoje mostra todos os dados)
- [ ] Onboarding wizard para novos anfitriões
- [ ] Perfil do anfitrião (nome, foto, bio)

### Fase 2 — Multi-tenant (infra)
- [ ] Vercel Pro → wildcard subdomínio `*.anfitriao.pt`
- [ ] Middleware para routing por subdomínio (`casadevasco.anfitriao.pt` → `/r/casadevasco`)
- [ ] Custom domain para anfitriões premium (`reservas.casadevasco.pt`)
- [ ] Billing (Stripe) para subscriptions

### Fase 3 — Crescimento
- [ ] Landing page de marketing em `anfitriao.pt`
- [ ] Dashboard super-admin (ver todos os anfitriões)
- [ ] Multi-idioma (PT/EN)
- [ ] App mobile nativa (React Native / Capacitor)
- [ ] Integração SIBA automática (SEF)

---

## Segurança — o que está implementado

| Medida | Estado |
|---|---|
| Autenticação anfitriões (Clerk JWT) | ✅ |
| Rotas protegidas (middleware) | ✅ |
| RLS Supabase (anon vs authenticated) | ✅ |
| CSP headers em produção | ✅ |
| CRON_SECRET para cron jobs | ✅ |
| Rate limiting na API do concierge AI | ✅ |
| `owner_id` em todas as tabelas | ✅ (dados, não RLS ainda) |
| RLS por `owner_id` (isolamento total) | ⏳ Fase 1.5 |
| Clerk JWT → Supabase (auth no DB) | ⏳ Fase 1.5 |

---

## Monetização sugerida

### Modelo freemium
| Plano | Preço | Limites |
|---|---|---|
| **Grátis** | €0/mês | 1 propriedade, 10 reservas/mês |
| **Starter** | €15/mês | 5 propriedades, reservas ilimitadas |
| **Pro** | €25/mês | Propriedades ilimitadas, custom domain, relatórios avançados |

### Alternativa: comissão
- 0% sobre reservas directas (proposta de valor)
- Cobrar mensalidade fixa pela ferramenta

---

## Contactos e acessos

| Serviço | URL | Notas |
|---|---|---|
| Vercel | vercel.com/vascotelo-7402s-projects/anfitriao | Deployments, env vars, domínios |
| Supabase | supabase.com (proj: nnbqfrszukkzoqwssjvg) | Base de dados, SQL editor |
| Clerk | dashboard.clerk.com | Gestão de utilizadores, domínios |
| Resend | resend.com | Emails transaccionais |
| GitHub | Repositório do projecto | CI/CD |

---

_Documento gerado automaticamente pelo Claude Code — actualizar após cada fase de implementação._
