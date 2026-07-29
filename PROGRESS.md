# Anfitrião — Progress Log

_Iniciado: 2026-06-06_

---

## Tarefas Concluídas

### [2026-07-29] Landing page nova (v2) — em produção

Redesenho completo da homepage de marketing: escuro por omissão, paleta ciano/esmeralda, animações com Motion + scroll suave com Lenis. Componentes em `src/components/landing-v2/` (header, hero, hero-visual, problem-solution, features, dashboard-preview, pricing, testimonials, faq, cta-section, newsletter, footer, smooth-scroll) e variantes partilhadas em `lib/landing-animations.ts`. Deployado e verificado no site real.

- 💰 **Preços reais, não os do briefing** — o briefing pedia €29/€79; a produção cobra Starter €19 / Pro €39. Decisão do Vasco: manter os reais. Anunciar preços diferentes dos que o Stripe cobra no checkout não era uma decisão técnica minha.
- 📦 **`lib/planos.ts`** — limites, preços (mensal e anual), `TRIAL_DIAS` e helpers de copy passaram a viver num módulo **sem dependências de runtime**. Foi de propósito: `lib/stripe.ts` faz `new Stripe(STRIPE_SECRET_KEY)` no topo, e as secções de preços são `'use client'` — importá-lo do browser levaria o SDK e a chave secreta para o bundle. `stripe.ts` reexporta `PLAN_LIMITS`/`PLAN_PRICE_EUR` para os importadores antigos não partirem. Confirmado que `.next/static` não contém segredos nem o SDK.
- 🧹 A copy da FAQ ("Starter até 3, Pro até 10", "14 dias") também deriva de `planos.ts` — era o sítio com mais probabilidade de divergir quando os preços mudassem.
- 🗑️ **`src/components/landing/` eliminada** — `pricing-section`, `commission-calculator` e `mobile-nav` ficaram órfãs ao substituir a homepage.
- 🗣️ **Tratamento por "tu"** — a copy nova nasceu formal ("você"); alinhada com a voz do resto do site e da app.
- 🔍 **SEO preservado** — FAQPage JSON-LD gerado a partir de `landing-v2/faq-data.ts` (fonte única com o acordeão). Os 6 links `/vs/*` de alta intenção migraram para uma secção própria do rodapé. `redirect('/hoje')` para sessão iniciada mantido.
- ⚖️ **Garantia de 30 dias recuperada** da landing anterior para a FAQ — é um compromisso comercial já publicado.
- 🎨 Escopo visual isolado em `.landing-v2` (globals.css): Inter no corpo, Geist nos títulos, escuro independente do tema guardado em `anf:theme`.

**Retirado antes de publicar** (nada disto podia ir para um site comercial):

- **Testemunhos inventados** — três depoimentos com nomes e cidades fictícios. Na UE, avaliações inventadas apresentadas como reais são prática proibida (Diretiva Omnibus). `TESTEMUNHOS` é agora um array vazio tipado e o componente devolve `null` enquanto estiver assim — volta ao ar sozinho mal existam depoimentos verdadeiros.
- **Newsletter** — o formulário confirmava "ficaste subscrito" sem subscrever ninguém (sem endpoint). Fora do rodapé; componente fica no repo.
- **Badge "Conforme o RGPD"** — afirmação de conformidade legal não verificável, ainda por cima num site sem política de privacidade acessível. Ficou só "Ligação encriptada", que é verdade.
- **Links para `/blog`, `/ajuda`, `/contacto`, `/termos`, `/privacidade`, `/cookies`** — não estão em `isPublicRoute`, por isso mandavam o visitante para o ecrã de login. Fora do rodapé e do menu.
- **Ícones LinkedIn/X** — apontavam para as homepages dessas redes, não para perfis do Anfitrião.

**Bugs corrigidos pelo caminho:**

- 🐛 **H1 sem espaços no `textContent`** — só apareceu ao inspecionar o site já publicado. O `mr-[0.25em]` dava espaço visual mas nenhum espaço textual: o Google e os leitores de ecrã liam `Centralizatudo.Hospedamelhor.` no elemento com mais peso de SEO da página. O espaço tem de ser um nó de texto **entre** os spans (dentro do `inline-block` é descartado). Obrigou a segundo deploy. **Lição: screenshot não valida texto acessível — verificar `textContent` de títulos animados palavra a palavra.**
- Gradiente do CTA invisível: `-z-10` punha-o atrás do fundo da página; resolvido com `isolate`.
- `lucide-react` v1 já não exporta ícones de marca (`Linkedin`, `Twitter`).
- Um screenshot saiu sem CSS por causa de um zombie `next-server` no porto 3000 — o caso já descrito no CLAUDE.md, não um defeito da página.

- ✅ 289 testes, typecheck 0, lint 0, build OK. Verificado no site em produção (desktop 1440px e mobile 390px): H1 correto, €19/€39, ambos os blocos JSON-LD, 6 links `/vs`, zero links mortos, zero erros de consola.

**Pendentes humanos:**
- **Páginas legais criadas mas por rever** — ver entrada seguinte.
- Depoimentos reais e autorizados para reativar a secção de testemunhos.
- Endpoint de subscrição para repor a newsletter.
- `/blog` e `/ajuda` continuam por criar.
- Landing anterior guardada em `.backups/page.landing-v1.20260729.tsx` (e no git).

---

### [2026-07-29] Páginas legais — `/termos`, `/privacidade`, `/cookies`

Criadas em `src/app/(legal)/` (grupo de rotas, não afeta URLs), com `PaginaLegal` em `components/landing-v2/pagina-legal.tsx` a dar o mesmo aspeto escuro da homepage. **Não deployadas** — têm campos por preencher.

- 📋 **Conteúdo derivado do código, não genérico.** Os campos do boletim de hóspede vieram de `lib/siba-fetch.ts` (nome, data de nascimento, sexo, nacionalidade, tipo/número/validade/país do documento). A lista de subcontratantes é a real: Clerk, Supabase, Vercel, Stripe, Resend, Anthropic.
- 🍪 **Zero rastreio, confirmado por grep** — não há Google Analytics, gtag, Posthog, Plausible, `@vercel/analytics` nem píxeis. A página de cookies pode portanto afirmar que só existem cookies estritamente necessários (sessão do Clerk) e `anf:theme` em localStorage, e explicar porque não há banner de consentimento. Se algum dia entrar analítica, **esta página passa a mentir** — atualizar em conjunto.
- ⚖️ **Distinção responsável/subcontratante** explícita: responsáveis pelos dados do anfitrião, subcontratantes quanto aos dados dos hóspedes (o anfitrião é que responde perante eles). É a distinção que costuma faltar neste tipo de produto.
- 🙅 **Limitações assumidas nos termos**, em vez de escondidas: o iCal não é instantâneo e não elimina a dupla reserva; a submissão ao SIBA é feita pelo anfitrião, não por nós. Alinhado com o que a FAQ já dizia.
- 🔗 `isPublicRoute` no `proxy.ts` e sitemap atualizados. Coluna Legal reposta no rodapé.
- 🐛 **Âncoras do rodapé passaram a absolutas** (`/#precos` em vez de `#precos`): o rodapé agora também aparece nas páginas legais, onde uma âncora isolada não levaria a lado nenhum.
- ✅ typecheck 0, lint 0, build OK (as três páginas são estáticas), 289 testes. Verificado que as três respondem sem sessão — antes o Clerk mandava para o login.

**Pendentes humanos (bloqueiam o deploy destas páginas):**
- **10 campos `[POR PREENCHER]`**, assinalados a amarelo na própria página para não passarem despercebidos: denominação social, NIF, morada, região de alojamento dos dados, prazos de conservação, IVA incluído ou não, limite temporal de responsabilidade, entidade de resolução de litígios de consumo.
- **Revisão por advogado.** Cada página abre com um aviso de rascunho por rever — remover `AvisoRevisao` depois da revisão.

---

### [2026-07-28] Fase 1 — resto do que não dependia de credenciais
Executado tudo o que faltava da Fase 1 do `docs/PLANO-ESTRATEGICO-2026.md` sem depender de chaves externas nem de decisões comerciais.

- 🛡️ **Alertas de conformidade (ANF-4.3)** — fecha o cofre construído a 27/07. `deveAlertar()` em `lib/compliance.ts` com marcos [30, 14, 7, 3, 1, 0] dias e repetição semanal depois de expirar (um seguro caducado não pode cair no silêncio, mas também não se avisa todos os dias). Cron `/api/cron/compliance-alerts` diário às 09:30: push + **um email por anfitrião**, nunca um por alojamento.
- 💡 **Noites órfãs (ANF-6.2)** — `lib/noites-orfas.ts` deteta buracos de 1–2 noites entre reservas dentro de 60 dias, ignora canceladas/no_show/encostadas/sobrepostas e nunca trata disponibilidade no fim do calendário como órfã. `descontoSugerido()` é heurístico e conservador (10–30%, mais agressivo quanto mais perto e mais curto) — documentado como ponto de partida até existir o motor de RM com dados reais (ANF-6.4). Cron semanal à segunda às 11:00.
- 🧭 **Navegação 14 → 6 (ANF-12.1)** — `lib/navigation.ts` passa a fonte única para side-nav, bottom-nav e ⌘K. Secções: Hoje · Calendário · Reservas · Alojamentos · Receita · Automação. Sub-navegação contextual só aparece dentro da secção ativa; Conta sai da navegação principal. `financeiro` renomeado para "Despesas e lucro" dentro de Receita, para desfazer a sobreposição com Relatórios. Mobile: 4 na barra + painel "Mais" com a mesma árvore (antes era uma lista plana de 14).
- ⌘ **Command palette (ANF-12.7)** — `global-search` deixa de ser só pesquisa de dados: passa a ter ações (nova reserva/alojamento/hóspede/artigo, exportar SIBA), navegação para qualquer destino, resultados agrupados por categoria, sugestões por omissão ao abrir e pesquisa insensível a acentos ("calendario" encontra "Calendário").
- ✨ **Motion nativo (ANF-12.6)** — só CSS: `@view-transition` para transições de página, `animation-timeline: view()` (com `@supports`) para revelação no scroll, `.lift` nos cards, `tabular-nums` em `th`/`td` para os números não dançarem. Bloco `prefers-reduced-motion` cobre as utilidades, o `tw-animate-css` e as View Transitions. **Zero JS adicionado.**
- ✅ **Onboarding persistente (ANF-12.10)** — `lib/onboarding.ts` (5 passos, 4 obrigatórios) + `OnboardingCard` no topo de `/hoje`, não numa página de boas-vindas isolada: uma checklist que só existe no primeiro login não ajuda quem parou a meio. Dispensável, com `useSyncExternalStore` sobre o localStorage (evita `setState` em efeito, que o lint do React Compiler rejeita).
- 📊 **Relatório mensal (ANF-6.7)** — `lib/relatorio-mensal.ts` calcula receita, noites, ocupação, ADR, RevPAR e receita por origem; receita atribuída ao mês do check-in (o critério que o anfitrião reconhece e o mesmo do financeiro). Cron dia 1 às 08:00 com comparação face ao mês anterior. Contas sem movimento não recebem email.
- 🇵🇹 **Inquérito do INE (ANF-4.13)** — `lib/ine.ts` com as definições oficiais do IPHH: hóspedes contam **no mês de entrada**, dormidas repartem-se pelos meses em que cada noite ocorre. Página `/conformidade/ine` com seletor de mês, totais, tabela por país, aviso de prazo (dia 10 do mês seguinte, a vermelho quando ultrapassado), exportação CSV e link para o WebInq. **Limitação assumida e dita na interface**: o INE pede *país de residência* e só recolhemos *nacionalidade* (é o campo do boletim SIBA) — usada como aproximação, com aviso para corrigir no WebInq.
- ✅ **230 testes** (86 novos), verificados em `TZ=Pacific/Kiritimati`, `Pacific/Midway` e `America/Sao_Paulo`. Typecheck 0, lint 0, build OK.
- ⚠️ **A confirmar**: o `vercel.json` passou de 4 para **7 cron jobs**. O plano Hobby da Vercel limita a 2 crons (1×/dia); se o projeto ainda estiver em Hobby, os crons acima do limite **não correm** — e isso já se aplicava aos 4 anteriores. Não foi possível verificar o plano (MCP da Vercel rate-limited). Verificar no dashboard antes de contar com os alertas.
- ⏭️ Continua bloqueado por credenciais: Upstash (rate limit), Sentry, PostHog, RLS via Clerk JWT (JWT template no dashboard), 2FA. E a política de privacidade (`/privacidade`) continua a ligar para lado nenhum.

### [2026-07-27b] Fase 1 de quick wins — copy honesta, comparações e cofre de conformidade
- 📄 **Plano estratégico**: `docs/PLANO-ESTRATEGICO-2026.md` — análise crítica completa (produto, UX/UI, conversão, revenue management, IA, compliance PT, SEO, performance, pricing) + roadmap em 5 fases + backlog de 15 épicos. Base de execução desta e das próximas sessões.
- 🔴 **Copy enganosa eliminada** (risco legal, não só de conversão). O claim "SIBA automático" estava em **6 sítios**, sendo os dois piores fora da landing: `conta/billing/page.tsx` (lista de funcionalidades do **plano pago**) e `lib/email/templates/platform.ts` (email de fim de trial). `lib/siba-api.ts` é um placeholder que devolve 501 — só existe exportação CSV. Substituído por "boletim SIBA pronto a submeter" e criada FAQ explícita *"O Anfitrião comunica os boletins ao SIBA por mim?" → "Ainda não de forma automática"*, com JSON-LD sincronizado.
- 🔴 **Claim do iCal corrigido**: "elimina as duplas reservas" → "reduz muito o risco, mas não o elimina", com a latência de 30 min–horas explicada na FAQ. Badge `SIBA ✓` do mockup → `Boletim pronto`.
- ✍️ **Headline**: "sem stress" → **"sem papelada"**, subheadline centrada em conformidade. ⚠️ Decisão deliberada: **não** foi usada a headline recomendada no plano ("SIBA, faturas e taxa turística. Tratados sozinhos.") porque faturação e taxa turística são Fase 2 — seria trocar um claim falso por um maior. Fica reservada para quando a Fase 2 fechar.
- 💰 **Garantia de reembolso de 30 dias** (decisão do utilizador): hero, CTA final, FAQ e JSON-LD. Pricing mantém-se em €19/€39 e trial de 14 dias — **decisão do utilizador de não mexer nesta fase**.
- 🔍 **6 páginas `/vs/[slug]`** (Smoobu, Lodgify, Guesty, Hostaway, Hospitable, Amenitiz) em `lib/comparacoes.ts`, no `sitemap.ts`, no footer e em `proxy.ts`. Regra editorial imposta no ficheiro: secção *"Onde o concorrente é melhor do que nós"* **antes** das nossas vantagens, bloco *"Quando não deves escolher o Anfitrião"*, e preços datados com link à fonte — credibilidade e proteção face ao DL 57/2008 (publicidade comparativa).
- 🛡️ **Cofre de conformidade (ANF-4.1/4.2/4.3)** — primeira funcionalidade que nenhum concorrente tem. `lib/compliance.ts` (lógica pura: RNAL, seguro RC, Livro de Reclamações, certificado energético; semáforos ok/a_expirar/expirado/em_falta com janela de aviso de 30 dias; base legal por item). Página `/conformidade` com resumo, edição inline e ação contextual por item. **Cartaz A4 do Livro de Reclamações** imprimível em `/conformidade/cartaz/[propertyId]` — sem dependência de PDF, usa CSS de impressão + "Guardar como PDF" do browser (mesma decisão do .xlsx no financeiro).
- 🗃️ Migração `027_compliance.sql` **aplicada em produção** (aditiva, colunas nullable): `rnal_numero`, `rnal_data`, `seguro_seguradora`, `seguro_apolice`, `seguro_validade`, `livro_reclamacoes_registado`, `livro_reclamacoes_url`, `certificado_energetico_validade` + índice parcial em `seguro_validade` para o futuro cron de alertas.
- 🔐 `/api/compliance` (PATCH) com allowlist estrita de campos — não escreve preço, capacidade ou qualquer outro atributo mesmo que venha no body; valida datas impossíveis (ex. 2026-02-31) que passam o regex ISO; verifica posse antes de escrever.
- ✅ **144 testes** (26 novos em `compliance.test.ts`, verificados também em `TZ=Pacific/Kiritimati` e `TZ=Pacific/Midway`), typecheck 0, lint 0, build OK.
- 🐛 **Encontrado, não corrigido**: o footer da landing liga para `/privacidade`, que **não existe** e não está em `proxy.ts` — o Clerk manda o visitante para o login. Uma política de privacidade é obrigatória num site que recolhe dados de passaporte. Não foi redigida por ser conteúdo legal (pendência humana).
- ⏭️ **Por fazer da Fase 1**: alertas de expiração por cron/push (ANF-4.3 parcial — a lógica e o índice já existem, falta a rota), Sentry/PostHog/Upstash (bloqueados por credenciais), RLS via Clerk JWT, navegação 13→6, checklist de onboarding, relatório mensal, INE, noites órfãs, ⌘K, motion. Indexação de `/r/[slug]` mantém-se `noindex` por decisão do utilizador.
- 🚀 **Não deployado** — tudo local, exceto a migração (aplicada em produção).

### [2026-07-19c] Nova arquitetura de emails — lib/email com provider, identidade e EmailService
- 🏗️ **`src/lib/email/`**: interface `EmailProvider` (Resend isolado num ficheiro; Noop sem key), `EmailIdentity` por anfitrião (derivada de `website_settings`), layout único de templates com blocos reutilizáveis, `EmailService` como ponto único de envio (7 métodos). ~500 linhas de HTML duplicado eliminadas dos 5 pontos de envio. Ver `docs/EMAILS.md`.
- ✉️ **Separação plataforma vs alojamento**: hóspede recebe `"Casa de Vasco via Anfitriões" <noreply@…>` com **Reply-To = email do alojamento** (novo); anfitrião recebe `"Anfitriões" <noreply@…>`. Envio sempre pelo domínio da plataforma (zero SPF/DKIM para clientes).
- 🐛 Removido `NOTIFY_EMAIL` (env global que desviava notificações de TODOS os anfitriões para uma caixa — resquício single-tenant).
- 🗃️ Migração `website_settings_email_identity`: + `cor_primaria`, `cor_secundaria`, `idioma`, `email_reservas`, `assinatura_email` (aplicada em produção). Campos editáveis na página /website.
- ✅ 118 testes (9 novos p/ email: From/Reply-To, sanitização de header injection, escape de HTML, identidade), typecheck 0, lint 0, build OK.
- ⚠️ Continua pendente: `EMAIL_FROM` no Vercel com domínio verificado no Resend (substitui `NOTIFY_FROM`).

### [2026-07-19b] Limpeza pré-produção — dados mock removidos da BD + config centralizada
- 🧹 **BD de produção limpa** (backup completo em `.backups/mock-dump-2026-07-19.json`, fora do git): apagados 3 propriedades seed (prop-1/2/3 — Alfama, Chiado, Cascais), 10 hóspedes de teste (guest-1..6, Teste Debug, Teste Manus, Zezé Camarinha, tia zezinha), 11 reservas (res-1..8 + 3 de teste manual) e todas as price_rules (6) e price_change_log (6), que só referenciavam props seed. Fica: **Casa de Vasco + 3 quartos, 0 reservas, 0 hóspedes** — única conta é a do Vasco.
- 🧹 `/api/book` deixa de aceitar ids legados não-UUID (já não existem na BD).
- 🔧 **`lib/config.ts` novo** — `APP_URL` e `NOTIFY_FROM` centralizados; 4 rotas (notify-confirmation, stripe/portal, cron/trial-reminders) tinham fallback hardcoded para o URL antigo `anfitriao-nine.vercel.app` (emails e redirects do Stripe apontariam para lá se `NEXT_PUBLIC_APP_URL` faltasse). 11 ficheiros migrados.
- ℹ️ Código já estava limpo: sem ficheiros de dados demo (localStorage é só tema); mockup da landing é ilustrativo e rotulado; templates do concierge são funcionalidade.
- ⚠️ Pendentes humanos p/ produção: `NOTIFY_FROM` com domínio verificado no Resend (fallback é onboarding@resend.dev); desligar `MAINTENANCE_MODE`; deploy (`npx vercel deploy --prod`).
- ✅ typecheck 0, lint 0, 109 testes, build OK.
- 🚀 **Deployado em produção** (2026-07-19, `vercel deploy --prod` → anfitrioes.pt). Smoke test OK: landing 200, feed iCal sem nomes/ids, /api/book valida UUID. Commits `889f72a` (copy) + `cb9fd4e` (segurança+prep).

### [2026-07-19] Auditoria de bugs — cadeia de PII no iCal fechada + /api/book endurecido
- 🔒 **Crítico corrigido**: o feed público `/api/ical/[propertyId]` expunha os UUIDs reais das reservas (UID) e nomes de hóspedes (SUMMARY). Com o propertyId visível nos URLs `/book`, qualquer pessoa podia obter bookingIds e puxar a PII completa do hóspede (documento, nascimento, telefone) via `GET /api/checkin/[bookingId]`. Agora: UID = sha256 do id (estável, não reversível) e summary genérico "Reservado"/"Bloqueado". Nota: plataformas que importam o feed veem UIDs novos uma vez (re-sync limpo, feed substituído por inteiro).
- 🔒 `/api/book` endurecido: rate limit (10/h por IP — convenção de rotas públicas), **preço recalculado no servidor** com `calculatePriceWithRules` (antes aceitava `preco_total` do cliente, 0–100k€), verificação de disponibilidade server-side (409 se datas ocupadas), rejeição de check-in no passado e estadias >365 noites, propriedade inativa → 404, limpeza do hóspede órfão se o insert da reserva falhar.
- 🔒 `GET /api/checkin/[bookingId]` com rate limit (60/h por IP) — devolve PII, dificulta enumeração.
- ✨ BookingClient mostra a mensagem de erro do servidor (ex.: "Estas datas já não estão disponíveis.") em vez de erro genérico.
- ✅ Auditado sem problemas: rotas privadas (auth + owner_id + `canUpsertRow`), crons (`checkCronAuth`), datas TZ-safe, iCal fetch via allowlist anti-SSRF, `documentos/extrair` e `concierge` com rate limit.
- ✅ Validação: typecheck 0, lint 0, 109 testes verdes (route.test.ts do /api/book reescrito com datas dinâmicas + casos 409/429/preço server-side), `next build` OK. **Não deployado** — falta `npx vercel deploy --prod`.

### [2026-07-13n] E2E autenticado: mecanismo pronto, bloqueado por MAINTENANCE_MODE
- ✅ **Mecanismo de login E2E funciona**: user de teste via Clerk Backend API + sign-in token consumido com `/sign-in?__clerk_ticket=<token>` (tokens são de uso único). Validado: autentica, `/hoje` renderiza o onboarding de primeira vez, formulário de nova propriedade preenche e submete.
- ⛔ **Bloqueios confirmados empiricamente**: (1) localmente, `ensureAccount`/`getAccountByClerkId` precisam de `SUPABASE_SERVICE_ROLE_KEY` (tabela accounts é service_role-only) e a key está marcada *sensitive* no Vercel (o `env pull` devolve vazio) → POST /api/properties responde 404 "Conta não encontrada"; (2) em produção, o **maintenance mode está ativo** — utilizador novo é redirecionado para `/em-construcao`.
- ➡️ Para completar o teste do onboarding: definir `MAINTENANCE_MODE=false` no Vercel (e re-correr contra produção) OU fornecer a service role key localmente. Limpeza feita: user Clerk apagado, 0 linhas órfãs na BD, ficheiros sensíveis removidos.

### [2026-07-13m] Contraste WCAG AA: 0 violações axe nas 4 páginas públicas ✅
- ✅ **Paleta ajustada com preview visual antes de aplicar** (identidade preservada — mesmo tom, mais profundo): `--primary` claro oklch 59%→52% (branco sobre terracotta ~3.6→>4.5:1); modo escuro inalterado.
- ✅ Badges emerald/amber do mockup e calculadora um degrau mais escuros; "Poupa 2 meses" por cor em vez de opacity; botões WhatsApp em teal escuro da marca (#075E54 sólido, #0F7060 outline); métricas dos features e comodidades dos quartos sem /70 fraco.
- ✅ **axe-core em produção: 0 violações WCAG 2.1 A/AA** na landing, /r/casadevasco, /book/prop-1 e /book multi-quarto. Decisão de contraste do 2026-07-13j resolvida.

### [2026-07-13l] db.ts limpo — bugs B1/B2 do HANDOFF fechados
- ✅ Os getters por ID sem filtro de owner (B1/B2, prioridade Alta) eram **código morto sem callers** — 30+ funções removidas do cliente anon (writes client-side incluídos), -265 linhas. `db.ts` fica só com os 3 getters das páginas públicas `/book`, documentado como tal. Páginas públicas verificadas em produção após deploy.

### [2026-07-13k] Documentação atualizada
- ✅ README reescrito (era boilerplate); HANDOFF atualizado ao estado atual (stack, migrations, env vars, pendentes); CLAUDE.md do projeto com convenções críticas (datas, owner_id, notify server-only, proxy.ts, PT-PT).
- ✅ Verificado que as promessas da landing (RevPAR, ocupação, receita por plataforma, YoY) existem mesmo em /relatorios.

### [2026-07-13j] Acessibilidade WCAG 2.1 AA nas páginas públicas
- ✅ Auditoria axe-core (mobile) às 4 páginas públicas; corrigido e re-verificado em produção: zoom desbloqueado (maximumScale removido — WCAG 1.4.4, afetava tudo), aria-label nos botões prev/next do calendário (critical) e nos links "voltar" só-ícone, carrossel de testemunhos focável por teclado.
- ⚠️ **DECISÃO DE DESIGN PENDENTE**: ~54 nós falham contraste AA — sobretudo texto branco sobre terracotta `#C2714F` (ratio ~3.5:1, AA pede 4.5:1 em texto pequeno) e badges pequenos sobre fundos `primary/10`. Corrigir implica escurecer o terracotta (ex: `#A85A3B`) ou criar um token mais escuro só para texto pequeno. Mexe na paleta da marca (PRODUCT.md) — decisão humana.

### [2026-07-13i] Site público /r/[slug]: quartos deixam de duplicar a listagem
- ✅ **Bug de produto (E2E)**: a listagem mostrava a casa-mãe E os 3 quartos como cards independentes ("7 alojamentos") — confuso, contagem inflacionada e risco de dupla reserva. Agora só propriedades de topo; casas com quartos mostram "desde X€" (quarto ativo mais barato). Verificado em produção ("4 alojamentos", zero erros de consola/rede).
- ✅ Crons Vercel auditados: ical-sync 04:00, payment-reminders 09:00, trial-reminders 10:00, CRON_SECRET presente. Nota de escala: sync 1×/dia é o limite do plano Hobby; ao crescer, subir para Pro e sync horário (janela de dupla reserva atual: 24h, mitigada pelo botão de sync manual).

### [2026-07-13h] Review da landing page + copy PT-PT
- ✅ Audit completo (mobile 375px + desktop): SEO sólido (title 49c, meta 156c, canonical, OG, 1 H1, FAQPage schema), sem scroll horizontal, imagens com dimensões, above-the-fold com CTA forte.
- ✅ Brasileirismos e inglês removidos do copy: planilhas→folhas de cálculo, Conecta→Liga, Sync→Sincroniza, OTAs→plataformas; grafia AO90 (atualizado, diretos, fim de semana). Deployado e verificado.
- ⚠️ **DECISÃO PENDENTE (humana)**: os 3 testemunhos com nome/cidade/5 estrelas (Ana Ferreira, Miguel Santos, Carla Mendes) aparentam ser fictícios — o produto ainda não lançou. Risco legal (publicidade enganosa) e de confiança. Opções: substituir por resultados do beta com consentimento, remover a secção até haver clientes reais, ou reformular como cenários ilustrativos claramente marcados.

### [2026-07-13g] E2E multi-quarto ✅ (sem bugs encontrados)
- ✅ Fluxo público multi-quarto validado em browser (Playwright, build de produção local + BD de produção): `/book/<parent>` renderiza os 3 quartos da Casa de Vasco com preços/capacidade/disponibilidade → "Reservar" → fluxo de reserva do quarto → confirmação. BD verificada: reserva no quarto certo, owner derivado, preço = noites × preço base do quarto. Dados de teste removidos.

### [2026-07-13f] Hoje: ações de 1 toque nos cartões
- ✅ Botão da próxima ação válida (Confirmar / Check-in / Check-out) diretamente nos cartões de chegadas, saídas e "em casa" (quando sai hoje) — sem abrir a reserva. Update otimista com rollback; confirmar dispara o email ao hóspede (mesmo fluxo da página da reserva).

### [2026-07-13e] Sweep de timezone — today() local
- ✅ **Bug sistémico**: `today()` devolvia a data UTC; em Lisboa (verão, UTC+1) a app inteira mostrava o dia anterior entre as 00:00 e a 01:00 (página Hoje, filtros, calendários, receita do mês, data mínima no site público). Corrigido para data local + teste.
- ✅ 20+ usos manuais de `new Date().toISOString().slice(0,10)` substituídos por `today()`/`addDays()` em 14 ficheiros; padding do calendário de preços tinha off-by-one próprio.
- ✅ Suite (105 testes) verde em Europe/Lisbon e Asia/Tokyo; deploy em produção verificado.

### [2026-07-13d] Push notifications PWA ✅ (item do backlog)
- ✅ **Nova reserva e check-in concluído → push no telemóvel do anfitrião.** Tabela `push_subscriptions` (migration 012, RLS só service_role), `lib/push.ts` (web-push + VAPID, limpa subscrições mortas, nunca lança, 4 testes), `/api/push` POST/DELETE com Clerk, handlers no `sw.js` (tocar abre a reserva), `PushToggle` em `/conta/perfil`.
- ✅ Push independente do RESEND_API_KEY (email continua opcional)
- ✅ VAPID keys geradas e configuradas em `.env.local` + Vercel production
- ✅ Limpeza: `store.ts`/`mock-data.ts` (código morto) removidos; `outputFileTracingRoot` cala warning de lockfiles
- ✅ Advisor Supabase re-verificado: sem regressões (1 WARN irredutível + 4 INFO, estado documentado)
- ℹ️ iOS: requer app instalada no ecrã inicial (PWA) para push funcionar — limitação da Apple

### [2026-07-13c] SIBA CSV injection + concierge com idioma automático
- ✅ **CSV formula injection neutralizado** — nomes/dados de hóspedes começados por `= + - @` eram executados como fórmulas no Excel do anfitrião. `lib/siba.ts` (escCsv, normalizeDate, buildSibaCsv) + 10 testes; rota valida `from`/`to`.
- ✅ **Concierge endurecido** — clamp de mensagem (4000) e contexto, whitelist de tone/idioma, parse JSON seguro
- ✅ **Concierge "Auto"** — novo default: responde no idioma da mensagem do hóspede, sem o anfitrião escolher
- ✅ Deploy em produção verificado (100 testes verdes)

### [2026-07-13b] E2E dos fluxos públicos + fix de perda de dados no check-in
- ✅ **E2E browser (Playwright)** — fluxo completo validado: `/book/prop-1` (calendário → dados → submit → confirmação com bookingId) e `/checkin/[id]` (preencher manualmente → SIBA → Confirmar → Obrigado). Reserva e check-in verificados na BD de produção; dados de teste removidos.
- ✅ **Bug real (perda de dados silenciosa)** — `/api/checkin` ignorava erros dos UPDATEs: com o admin client em fallback anon, o RLS rejeitava as escritas mas o hóspede via "Obrigado" e nada ficava gravado. Agora devolve 500 e o formulário mostra erro. Corrigido + deployado + revalidado E2E em produção.
- ℹ️ Item crítico do backlog "testar fluxo onboarding→reserva→check-in" parcialmente coberto (partes públicas); onboarding autenticado requer sessão Clerk.
- ⚠️ Infra local: `next dev --webpack` pendura sob carga no WSL2 (CPU spin); para E2E usar `npm run build && npm run start`.

### [2026-07-13] Testes automatizados + hardening de endpoints públicos
- ✅ **Vitest configurado** — `npm test` / `test:watch` / `test:coverage`; 90 testes em `src/**/*.test.ts`
- ✅ **Bug real (timezone)** — `utils.addDays` usava meia-noite local + `toISOString()`, devolvia o dia anterior em TZ > UTC (Europe/Lisbon no verão). Afetava a data mínima de reserva no `/book` e a navegação do calendário. Corrigido para UTC; duplicado em `calendario/page.tsx` removido.
- ✅ **Endpoints de email fechados** — `/api/notify-payment-reminder` removido (público, sem callers, abusável); `/api/notify-checkin-complete` convertido em lib server-only (`lib/notify-checkin.ts`); `/api/notify-confirmation` exige Clerk + ownership. Mesma classe do `/api/notify-booking` removido a 2026-07-10.
- ✅ **SSRF/ical** — `lib/ical-fetch.ts` (allowlist HTTPS, revalidação pós-redirect, timeout, cap 5MB); `ical-sync` faz fetch direto; `/api/ical-proxy` autenticado
- ✅ **Check-in público** — rate limit 10/h/IP, clamps de tamanho/formato em todos os campos
- ✅ **Bug (guest UX)** — `/api/documentos/extrair` não estava na lista pública do middleware: o scan de documento falhava silenciosamente para hóspedes anónimos no check-in online. Corrigido + cap 8MB + whitelist de media types.
- ✅ **Testes em 3 timezones** — suite passa em Europe/Lisbon, Asia/Tokyo, America/Los_Angeles

### [2026-07-10] Lint a zero + segurança do fluxo de reserva
- ✅ **Lint 27 → 0** — código morto removido em 14 ficheiros; `no-unused-vars` com `ignoreRestSiblings`/`^_`; disables justificados (Date.now server layout, exhaustive-deps intencionais, `<img>` para URLs arbitrários)
- ✅ **`/api/book` endurecido** — whitelist de campos (anti mass-assignment: `estado`/`origem`/`owner_id` forçados no servidor), validação de email/datas/limites, parse JSON seguro
- ✅ **Email de nova reserva server-side** — `lib/notify-booking.ts` (server-only); `/api/book` envia após insert. Removido `/api/notify-booking` (endpoint público que permitia enviar emails arbitrários pelo Resend do projeto) + entrada no proxy + chamada client-side
- ℹ️ Onboarding wizard `/conta/bem-vindo` verificado: **já usa estado real** (propriedades, iCal, website) — item do backlog obsoleto

### [2026-06-30] Hardening RLS + teste de reserva em produção
Limpeza completa do RLS no projeto Supabase `anfitriao` (`nnbqfrszukkzoqwssjvg`). Advisor de segurança: **21 lints → 5** (1 WARN intencional + 4 INFO benignos).

- ✅ **`fs_*` verificadas** — RLS ativo, 0 políticas (anon/authenticated bloqueados, só `service_role`). Já resolvido; backlog estava desatualizado. Ver secção Segurança.
- ✅ **Cross-tenant fechado** — removidas 9 policies `authenticated_full_*` (`USING(true)`, role `authenticated`) que anulavam o isolamento owner-scoped (`requesting_owner_id`). Migration `009_rls_drop_authenticated_full.sql`. Incluía `accounts` (faturação) exposta a qualquer autenticado.
- ✅ **UPDATE anon mortos removidos** — `public_update_booking_historico` + `guests_checkin_update` (`USING(true)`). Check-in usa `service_role` via `/api/checkin`, não anon. Migration `010_rls_drop_unused_anon_checkin_update.sql`.
- ✅ **INSERT anon consolidados** — 4 → 2 policies. Removidas `bookings_public_insert` (superset de `public_insert_bookings` `origem='direto'`) e `guests_checkin_insert` (duplicado de `public_insert_guests`). Migration `011_rls_consolidate_anon_insert.sql`.
- ✅ **Teste de reserva em produção** — `POST https://anfitrioes.pt/api/book` (`prop-1`, `origem='direto'`) → **HTTP 200 `{"ok":true}`**. Verificado na BD: hóspede + reserva criados com `owner_id` derivado da propriedade; encadeamento guest→booking OK. Dados de teste (`TEST-RLS-*`) removidos após verificação. Funciona com ou sem `SUPABASE_SERVICE_ROLE_KEY` definida (a policy anon `origem='direto'` cobre o fallback). Sem emails enviados (`/api/book` não dispara `notify-booking`).
- ✅ **Documentação** — `CLAUDE.md` raiz do workspace atualizado (adicionado `robertaccakes`); removida pasta lixo `C:/` (árvore de paths Windows vazada para o WSL, 0 ficheiros).

> **Resíduo aceitável:** 1 WARN `public_insert_guests` (submissão pública insert-only, não estreitável por `owner_id` nulo) + 4 INFO `rls_enabled_no_policy` (`accounts` só `service_role`; `fs_*` bloqueadas). Pendente humano: configurar Clerk JWT template no Supabase (ativa o owner-scoped para multi-tenant).

### [2026-06-16] Segurança, UX e CRO (sessão anterior)
- ✅ **Supabase RLS**: ativado em `fs_deals`, `fs_alerts`, `fs_price_history` (3 ERRORs → 0 ERRORs)
- ✅ **Supabase functions**: `SET search_path = ''` em `update_atualizado_em_accounts`, `accounts_set_atualizado_em`, `requesting_owner_id`
- ✅ **Website page**: campo slug adicionado ao formulário (preview live da URL, validação, sanitização)
- ✅ **Website settings API**: tratamento de erro de slug duplicado (`23505` → mensagem em PT)
- ✅ **Landing page**: `CommissionCalculator` component adicionado entre Features e Como Funciona
- ✅ **Deploy**: produção em `anfitrioes.pt` (dpl_ETHGjHvYaDVe2zXUfy5yEfL3muYp)

### [2026-06-16] Pendente (ação humana obrigatória)
- ⚠️ **MAINTENANCE_MODE=false** no Vercel Dashboard → Settings → Environment Variables → redeploy
- ⚠️ **Clerk JWT template** no Supabase: Clerk Dashboard → Configure → JWT Templates → "Supabase" → copiar JWT Secret do Supabase Auth

### [2026-06-06] Análise completa do projecto
- Lidos todos os ficheiros fonte (~100 ficheiros)
- Identificados bugs, riscos de segurança e oportunidades de melhoria

### [2026-06-06] Segurança e multi-tenancy
- ✅ Middleware Clerk (`src/middleware.ts`) — protecção de rotas, maintenance mode
- ✅ Página `/em-construcao` — acesso público durante manutenção
- ✅ `getWebsiteSettings()` corrigido — aceita `ownerId`, fallback para id=1
- ✅ `hoje/page.tsx` e `website/page.tsx` — passam `ownerId` ao DB

### [2026-06-06] Landing page
- ✅ Preços corrigidos: €19/€39 (alinhados com Stripe Price IDs em billing)
- ✅ Hero, features, pricing, CTA, footer

### [2026-06-06] SEO
- ✅ Root metadata (OG, Twitter Cards, description, keywords)
- ✅ `robots.ts` — permite landing, `/r/`, `/book/`; bloqueia app routes
- ✅ `sitemap.ts` — URL canónica da landing

### [2026-06-06] RLS Supabase (migration 008)
- ✅ `requesting_owner_id()` function criada
- ✅ RLS ativo em: properties, guests, bookings, website_settings, price_rules, tarifas, platform_rates, price_change_log
- ✅ Aplicado em produção (project `nnbqfrszukkzoqwssjvg`)

### [2026-06-06] Documentação
- ✅ `docs/HANDOFF.md` criado — estado completo, env vars, o que falta, passos de lançamento

### [2026-06-09] SEO, segurança e infraestrutura Clerk JWT
- ✅ `og:image` dinâmico em `/r/[slug]` — título do site do anfitrião, OG + Twitter cards
- ✅ `/r/[slug]` `robots: noindex` (site público de reservas não deve aparecer em resultados gerais)
- ✅ `createUserClient(token)` em `lib/supabase.ts` — cliente Supabase com Clerk JWT para RLS
- ✅ `lib/supabase-server.ts` — `getSupabaseForRequest()` helper server-only; usa JWT quando disponível, fallback para admin client + filtro manual
- ⚠️ Tabelas `fs_deals`, `fs_alerts`, `fs_price_history` sem RLS — ver secção Segurança abaixo

---

## Backlog (por prioridade)

### 🔴 Crítico (bloqueia lançamento público)
- [ ] Configurar Clerk JWT template no Supabase Dashboard → o RLS por owner_id só actua em chamadas client-side com JWT Clerk válido
  - Clerk Dashboard → Configure → JWT Templates → New → "Supabase"
  - Supabase Dashboard → Authentication → JWT Secret → copiar e colar no Clerk template
- [ ] Testar fluxo completo onboarding (novo user → propriedade → reserva → check-in)
- [ ] `MAINTENANCE_MODE=false` em Vercel → redeploy
- [x] Resolver RLS das tabelas `fs_*` ✅ (verificado 2026-06-30: RLS ativo, 0 políticas → anon/authenticated bloqueados; advisor só reporta INFO)
- [x] 🔴 **Cross-tenant**: removidas policies `authenticated_full_*` das 9 tabelas core ✅ (2026-06-30, migration `drop_authenticated_full_blanket_rls_policies`) — ver secção Segurança

### 🟡 Importante
- [x] Onboarding wizard para novos anfitriões ✅ (verificado 2026-07-10: já usa estado real)
- [x] Perfil do anfitrião editável (`/conta/perfil`) ✅
- [x] Export SIBA (CSV para portal SEF) ✅

### 🔵 UX/UI
- [ ] Página 404 melhorada (já existe, funcional)
- [x] og:image dinâmico ✅

### ⚪ Funcionalidades futuras
- [ ] Subdomain routing (`*.anfitrioes.pt`)
- [ ] Push notifications (PWA)
- [~] Notificações email — nova reserva ✅ server-side (2026-07-10); check-in/pagamento têm rotas mas requerem RESEND_API_KEY configurada

---

## ✅ Segurança — Tabelas `fs_*` (RESOLVIDO)

Verificado 2026-06-30 via advisor: `fs_deals`, `fs_alerts`, `fs_price_history` têm RLS **ativado** com **0 políticas** → acesso anon/authenticated bloqueado (só `service_role`). Advisor reporta apenas `INFO` (`rls_enabled_no_policy`), nenhum ERROR. Não pertencem a nenhum projeto Supabase ativo desta org (resíduo). Nada a fazer.

## ✅ Segurança — Cross-tenant nas tabelas core (RESOLVIDO 2026-06-30)

As tabelas `properties`, `bookings`, `guests`, `tarifas`, `price_rules`, `platform_rates`, `price_change_log`, `website_settings`, `accounts` tinham policies `authenticated_full_*` para `ALL` com `USING (true) WITH CHECK (true)` no role `authenticated`. Como o RLS é permissivo (OR), anulavam o isolamento owner-scoped via `requesting_owner_id()` (migration 008): qualquer utilizador autenticado lia/escrevia dados de todos os anfitriões (incl. `accounts` = dados de faturação).

**Verificação no código antes de remover:** o client `anon` (`lib/db.ts`) só é usado pelas páginas públicas `/book` (role `anon`); todo o acesso autenticado passa por API routes (`createAdminClient` → `service_role`, bypassa RLS) ou pelo user-client owner-scoped (`getSupabaseForRequest`). Nenhuma leitura autenticada client-side dependia das blanket policies.

**Correção:** migration `drop_authenticated_full_blanket_rls_policies` removeu as 9 policies. Mantêm-se as owner-scoped (`authenticated`) e as públicas (`anon`). Advisor confirma 0 WARN `authenticated_full_*`. `accounts` ficou só com `service_role` (alinhado com `accounts.ts`).

### UPDATE anon removidos (2026-06-30, migration `drop_unused_anon_checkin_update_policies`)
As policies anon `public_update_booking_historico` (bookings) e `guests_checkin_update` (guests) usavam `USING(true)` e permitiam a qualquer anónimo reescrever qualquer reserva/hóspede. Verificado no código que o check-in atualiza estas linhas **exclusivamente via `/api/checkin/[bookingId]` com `service_role`** (a página cliente só faz `fetch` à rota) — não há UPDATE anon na app. Como não existe coluna de token de check-in (o `bookings.id` é o identificador da URL) e o RLS não restringe colunas, "restringir por token" seria no-op ou exigiria degradar o fluxo `service_role` para anon. Por isso as policies foram **removidas** (correção máxima), em vez de estreitadas. Check-in inalterado (continua via `service_role`).

### INSERT anon consolidados (2026-06-30, migration `consolidate_redundant_anon_insert_policies`)
Os inserts públicos passam por `/api/book` (`createAdminClient`: `service_role`, ou fallback anon-key). 4 policies anon de INSERT reduzidas a 2 (uma por tabela), seguras em ambos os cenários:
- **bookings:** removida `bookings_public_insert` (`WITH CHECK true`) — superset redundante de `public_insert_bookings` (`origem='direto'`), que cobre todo o insert do `/book` (payload traz sempre `origem='direto'`). WARN eliminado.
- **guests:** removida `guests_checkin_insert` (duplicado exato de `public_insert_guests`; o check-in não faz insert anon, usa `service_role`). Mantida `public_insert_guests`.

**Estado final do advisor:** 1 WARN (`public_insert_guests`, anon INSERT `WITH CHECK true`) — irredutível: submissão pública de hóspede insert-only; não é estreitável por `owner_id` porque `/api/book` pode inserir com `owner_id` nulo (propriedade sem owner). Padrão legítimo (igual a orders/newsletter). Restantes lints: 4 `INFO` `rls_enabled_no_policy` (`accounts` = só service_role; `fs_*` = bloqueadas) — benignos.

**SQL para activar RLS (ATENÇÃO: activa RLS mas bloqueia todo o acesso sem políticas definidas):**

```sql
-- Só executar depois de definir políticas adequadas!
ALTER TABLE public.fs_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_price_history ENABLE ROW LEVEL SECURITY;
```

**Opção mais segura** — activar RLS com política de bloqueio total (se estas tabelas não são usadas pelo anfitriao):
```sql
ALTER TABLE public.fs_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_price_history ENABLE ROW LEVEL SECURITY;
-- Sem políticas = acesso bloqueado para anon e authenticated
-- service_role ainda tem acesso
```

Se estas tabelas são do projecto `luxe_radar`, adicionar políticas adequadas antes de activar RLS.

---

## Decisões de arquitectura tomadas

| Data | Decisão | Razão |
|---|---|---|
| 2026-06-06 | Preços landing → €19/€39 | Billing page é fonte autoritária (tem os Stripe Price IDs) |
| 2026-06-06 | MAINTENANCE_MODE=true por defeito | Site ainda não público, só admin acede |
| 2026-06-06 | Não alterar schema website_settings agora | Funciona para single-tenant; RLS cobre multi-tenant |
| 2026-06-06 | RLS usa `requesting_owner_id()` via JWT `sub` | Compatível com Clerk; service_role (API routes) bypassa RLS como esperado |
