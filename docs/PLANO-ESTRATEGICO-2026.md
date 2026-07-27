# Anfitrião — Análise Crítica e Plano Estratégico

**Data:** 2026-07-27
**Âmbito:** produto, UX, UI, conversão, revenue management, automação, IA, compliance PT, SEO, performance, pricing, escalabilidade
**Base de análise:** código-fonte em `~/projetos/anfitriao` (549 ficheiros de app, 12.5k linhas de páginas), site em produção `https://anfitrioes.pt`, `TODO.md`, `PROGRESS.md`, `PRODUCT.md`, benchmarking de 9 concorrentes, legislação AL PT vigente.

> Este documento não elogia o produto. Assume que a barra é "melhor plataforma de gestão de AL da Europa" e mede tudo contra essa barra.

---

## 0. Sumário executivo — a verdade desconfortável

O Anfitrião está muito mais construído do que a landing page sugere (28 rotas de app, 20+ APIs, Stripe Connect, OCR, motor de automações, sites por tenant, blog multi-tenant, admin com MRR). O problema **não é falta de features**. São seis problemas estruturais:

**P1 — O produto vende três promessas que não cumpre.**
- *"Check-in online com SIBA automático"* (meta description da homepage). `lib/siba-api.ts` é um **placeholder que devolve 501**. O que existe é exportação CSV manual. Isto é publicidade enganosa com risco real de estorno, queixa DECO/ASAE e destruição de confiança no exato ponto em que a confiança é o produto.
- *"Os bloqueios são enviados de volta"* + *"elimina as duplas reservas"*. É iCal. iCal tem latência de 30 min a 4 h no Airbnb e até 3 h no Booking. **iCal não elimina duplas reservas — reduz-as.** Qualquer host que apanhe uma dupla reserva depois desta frase pede reembolso e escreve sobre isso.
- *"Site de reservas diretas… elimina as comissões das plataformas"*. Os sites `/r/[slug]` estão em **`noindex`** (decisão de 2026-07-27) e vivem num subdiretório partilhado, sem domínio próprio (bloqueado por orçamento Vercel Pro). Um site que o Google não indexa e que não tem domínio próprio **não gera uma única reserva direta**. A feature existe tecnicamente e vale zero comercialmente.

**P2 — Zero prova social. Zero.**
A landing tem uma secção de "cenários" com um comentário no código a dizer literalmente: `// Cenários de uso ilustrativos — não são testemunhos de clientes.` Não há logos, não há números ("X anfitriões", "Y reservas geridas"), não há screenshots do produto, não há vídeo, não há reviews. Vender SaaS de €19–39/mês a um público desconfiado (o anfitrião português médio já foi queimado por software) sem uma única prova é a maior causa isolada de não-conversão. **Nada no resto deste plano importa mais do que isto.**

**P3 — O fosso competitivo real está em compliance fiscal portuguesa, e está vazio.**
O Anfitrião cobre SIBA (parcialmente). Não cobre: **faturação certificada + SAF-T + comunicação à AT**, **taxa turística municipal**, **INE**, **Livro de Reclamações Eletrónico**, **RNAL/licença**, **IRS Cat. B/F**, **seguro obrigatório**. Um anfitrião com 3 apartamentos em Lisboa tem 5 obrigações mensais recorrentes; o Anfitrião automatiza meia. Guesty/Hostaway/Lodgify **nunca farão isto** — não é rentável para eles. É aqui que está o "porque escolheria outra coisa?" e está por explorar.

**P4 — Risco técnico de isolamento multi-tenant.**
Confirmado no próprio `TODO.md`: RLS por JWT do Clerk **nunca foi ligado**; `getSupabaseForRequest` é código morto. O isolamento real é `service_role` + `.eq('owner_id', userId)` aplicado à mão em ~20 rotas. **Uma linha esquecida = fuga de dados de passaporte entre contas.** Já aconteceram dois incidentes deste tipo (RLS `anon` aberto em `guests`/`bookings`; `website_settings.id DEFAULT 1`). Com dados SIBA em causa isto é um evento de RGPD com coima até 20 M€ / 4 % do volume. Não é dívida técnica — é risco existencial.

**P5 — Rate limiting em memória num runtime serverless.**
`lib/rate-limit.ts` guarda estado no processo. Na Vercel cada invocação pode ser uma instância nova. **O rate limit das rotas públicas (`/api/book`, `/api/checkin`, `/api/concierge`) é efetivamente inexistente.** Custo de IA e spam de reservas ficam abertos.

**P6 — Não há revenue management nenhum.**
O "Sistema de preços" são regras manuais (`price_rules`, `tarifas`, `platform_rates`). Não há dados de mercado, não há previsão de ocupação, não há pace/pickup, não há recomendação. O ficheiro `precos/page.tsx` tem **1474 linhas** — um monólito para configurar à mão aquilo que a concorrência já faz sozinha. Isto é o oposto de "sem stress".

**Diagnóstico:** o Anfitrião é hoje um bom *organizador* de AL. Para ser a melhor plataforma da Europa tem de passar a ser um *piloto automático de conformidade e receita para Portugal*, e depois exportar esse modelo para Espanha/Itália/Grécia — mercados com o mesmo problema regulatório e a mesma ausência de solução local.

---

# FASE 1 — RELATÓRIO DE ANÁLISE

## 1. UX — tudo o que dificulta a utilização

### 1.1 Arquitetura de informação

A navegação tem **13 destinos de topo** (`hoje`, `calendario`, `reservas`, `hospedes`, `propriedades`, `precos`, `financeiro`, `relatorios`, `documentos`, `automacoes`, `concierge`, `website`, `blog`, `conta`). Para um utilizador com 1 apartamento e um emprego a tempo inteiro — a persona declarada no `PRODUCT.md` — isto é ruído. Linear tem 5. Stripe tem 7.

| Problema | Evidência | Consequência |
|---|---|---|
| 13 secções de topo, sem agrupamento | `side-nav.tsx`, `bottom-nav.tsx` | Paralisia de escolha; o utilizador não descobre `automacoes` nem `relatorios` |
| `financeiro` e `relatorios` são conceitos sobrepostos | páginas separadas, ambas com KPIs de receita | O utilizador não sabe onde ir ver "quanto ganhei" |
| `precos` e `propriedades/[id]/editar` ambos definem preço | `preco_base` na propriedade, `price_rules` em preços | Fonte de verdade ambígua; suporte previsível |
| `website` + `blog` são um produto dentro do produto | duas secções de topo para uma feature secundária | Dilui o núcleo (reservas/compliance) |
| Não há entidade "tarefa" | inexistente | Todo o trabalho operacional (limpeza, manutenção) vive fora da app |

**Recomendação de IA (arquitetura):** colapsar para 6 destinos — **Hoje · Calendário · Reservas · Alojamentos · Receita · Automação** — com `hóspedes`, `documentos`, `preços`, `website`, `blog` como sub-navegação contextual dentro destes. `Conta` sai da navegação principal para o avatar.

### 1.2 Fluxos demasiado longos

- **Onboarding.** `conta/bem-vindo` existe (192 linhas) mas não há checklist persistente de ativação, não há dados de exemplo, não há "importa o teu primeiro iCal em 60 s". O utilizador cria conta e cai num dashboard vazio. **Time-to-value indefinido e não instrumentado.** Não existe qualquer ferramenta de analytics no projeto (nenhum PostHog/Amplitude nas dependências) — ou seja, **não é possível saber onde as pessoas desistem**. Isto é operar às cegas.
- **Criar reserva manual.** `reservas/nova/page.tsx` tem 462 linhas. Um formulário longo onde deveria haver: escolher datas no calendário → nome → feito.
- **Configurar preços.** 1474 linhas numa página. Três conceitos concorrentes (regras, tarifas, taxas de plataforma) expostos crus ao utilizador. Viola diretamente o princípio declarado "se demora mais de 2 toques está errado".
- **Ligar iCal.** É copy-paste de URLs entre 2–4 separadores do browser, no telemóvel. É o passo mais crítico do onboarding e é o mais frágil. Não há validação em tempo real, não há deteção automática da plataforma pelo formato do URL, não há instruções com screenshots por plataforma.

### 1.3 Mobile

`PRODUCT.md` diz "mobile canónico, desktop é bónus". Na prática existe `bottom-nav.tsx` (6.9K) e `side-nav.tsx` (6.6K) — duas navegações paralelas a manter. Com 13 destinos, a bottom-nav não consegue mostrar tudo: obriga a um menu "mais", que é onde as features vão morrer. Páginas como `precos` (1474 linhas) e `relatorios` (716 linhas) são desktop-first por natureza — tabelas densas não colapsam bem.

**Faltam completamente:** gestos (swipe para confirmar check-in), pull-to-refresh, ações rápidas offline, haptics. É PWA (`pwa-register.tsx`, manifest, push) mas não *sente* como app.

### 1.4 Dark mode

Existe (`@custom-variant dark`), mas a paleta principal está definida como "warm off-white — sol numa parede portuguesa". **A identidade de marca inteira assenta na luz.** Em dark mode essa identidade desaparece e o produto fica igual a qualquer shadcn/ui genérico. Não há decisão de design para dark mode — há um fallback.

### 1.5 Velocidade percebida

- Não há skeleton states sistemáticos, não há optimistic UI.
- `precos`, `relatorios`, `calendario` são páginas grandes que provavelmente fazem fetch em cascata.
- A sincronização iCal (`/api/ical-sync`) é síncrona e por pedido — sem feedback de progresso, sem fila, sem retry visível.

### 1.6 Falhas de CTA dentro do produto

Estado vazio sem ação é o padrão dominante: uma conta nova vê `hoje` vazio, `reservas` vazio, `hóspedes` vazio — sem nenhum caminho sugerido. Não há upgrade prompts contextuais (o utilizador no plano Starter que tenta criar a 4.ª propriedade devia ver um upsell desenhado, não um erro).

---

## 2. UI — o que impede o efeito "WOW"

### 2.1 Tipografia

`Geist` + `Geist_Mono` para tudo, com `--font-heading` = `--font-geist-sans`. **Headings e body na mesma fonte, no mesmo peso de família.** O `PRODUCT.md` lista como anti-referência "generic SaaS blue, inter on white" — Geist em off-white é exatamente o mesmo arquétipo com outro nome. Não há contraste tipográfico, não há voz.

**Recomendação:** manter uma sans neutra para dados/UI, mas introduzir uma display com carácter para headings e números grandes. Direção: uma grotesca com detalhe (ex.: *Söhne*, *Untitled Sans*, *Neue Haas*) ou, mais barato e mais português, uma display humanista com terminações abertas. Números em variante tabular obrigatória em toda a app financeira — hoje não há garantia disso e as tabelas de receita vão "dançar".

### 2.2 Cor

Um acento (terracota `#C2714F`), ≤10 % de superfície. A decisão é boa e é a coisa mais distintiva do produto. **Mas não está a ser explorada.** Falta:
- Escala completa de terracota (50→950) para estados, não só o acento.
- Cores semânticas de negócio: ocupação, receita, plataforma (Airbnb/Booking/direto precisam de identidade visual consistente no calendário e nos relatórios — hoje há `properties.cor` definido pelo utilizador, o que garante inconsistência).
- Um segundo tom frio para dados/gráficos, senão todos os gráficos ficam monocromáticos e ilegíveis.

### 2.3 Hero

Headline atual: **"Gere o teu Alojamento Local sem stress"**.
Problema: é uma promessa emocional genérica, sem especificidade e sem diferenciação. Qualquer um dos 9 concorrentes podia usar esta frase. Não menciona Portugal, não menciona SIBA, não menciona dinheiro.

Não há screenshot do produto, não há vídeo, não há animação. O hero é texto + dois botões. Para um produto cuja proposta é "a interface fala primeiro" (`PRODUCT.md`), **o hero não mostra a interface**.

### 2.4 Cards, animações, microinterações

`tw-animate-css` está instalado mas o produto é estático. Não há:
- Transições de página (View Transitions API — suportado, custo quase zero em Next 16).
- Hover states com profundidade nos cards de feature.
- Contadores animados nos KPIs.
- Estados de sucesso com feedback (o check-in concluído devia ser um momento de deleite — é o momento em que o host percebe o valor).
- Scroll-driven animations (CSS `animation-timeline: view()` — nativo, zero JS, zero custo de performance).

### 2.5 Hierarquia visual

Nos relatórios e no financeiro, tudo tem o mesmo peso: KPI, tabela, filtro. Falta a decisão editorial de "esta é a única coisa que interessa hoje". Stripe/Linear ganham exatamente aqui: **um número grande, tudo o resto subordinado.**

---

## 3. Conversão — tudo o que está a impedir vendas

Ordenado por impacto destrutivo.

| # | Bloqueio | Gravidade | Porquê |
|---|---|---|---|
| 1 | **Zero prova social** | 🔴 Crítico | Nenhum testemunho, logo, número, review, case study. Confirmado no código. |
| 2 | **Zero screenshots / vídeo do produto** | 🔴 Crítico | Vende-se software sem o mostrar. Taxa de conversão de landings sem visual de produto é tipicamente 2–4× inferior. |
| 3 | **Promessas não cumpridas ("SIBA automático")** | 🔴 Crítico | Converte mal (utilizadores informados detetam) e churna pior (os que compram descobrem). |
| 4 | **Sem plano gratuito permanente** | 🟠 Alto | Só trial de 14 dias. AL é sazonal: 14 dias em janeiro não provam nada. Hospitable tem tier a $0. |
| 5 | **Sem página de comparação** | 🟠 Alto | Não existe `/vs/smoobu`, `/vs/lodgify`, `/alternativa-a-guesty`. É tráfego de alta intenção deixado à concorrência. |
| 6 | **Sem garantia explícita** | 🟠 Alto | Não há "30 dias, devolvemos o dinheiro". Fricção pura de decisão. |
| 7 | **Calculadora de comissões subaproveitada** | 🟠 Alto | Existe (`commission-calculator.tsx`) e é o melhor ativo de conversão da página — mas está a meio da página e não captura email. |
| 8 | **CTA único e repetido** | 🟡 Médio | "Criar conta grátis" em todo o lado. Falta CTA secundário de baixo compromisso ("Ver demonstração de 2 min", "Calcular quanto poupo"). |
| 9 | **Sem urgência nem escassez** | 🟡 Médio | Nada. Nem "preço de lançamento", nem "primeiros 100 anfitriões". |
| 10 | **FAQ defensiva, não persuasiva** | 🟡 Médio | 5 perguntas, todas operacionais. Falta "e se eu já uso o Smoobu?", "os meus dados estão seguros?", "quanto tempo poupo por semana?" |
| 11 | **Sem live chat / contacto humano** | 🟡 Médio | Só `suporte@anfitrioes.pt`. Para o primeiro cliente, o email é lento demais. |
| 12 | **Ambiguidade de marca** | 🟡 Médio | Produto "Anfitrião", domínio `anfitrioes.pt`, decisão em aberto no `TODO.md` (#5). Prejudica recall e SEO de marca. |

### 3.1 Headline — alternativas

| Ângulo | Proposta |
|---|---|
| Compliance (recomendado) | **"SIBA, faturas e taxa turística. Tratados sozinhos."** <br>*sub:* Sincroniza Airbnb e Booking, faz o check-in online e trata das obrigações legais do teu Alojamento Local. Feito em Portugal, para a lei portuguesa. |
| Dinheiro | **"Poupa 3.600 € por ano em comissões. E 6 horas por semana."** |
| Tempo/alívio | **"O teu Alojamento Local, resolvido antes de acordares."** |

O ângulo de compliance é o único que a concorrência internacional **não consegue copiar**. É a headline correta.

---

## 4. Produto — funcionalidades existentes vs. em falta

### 4.1 O que existe (auditado no código)

| Área | Estado | Nota crítica |
|---|---|---|
| Sincronização iCal (import + export) | ✅ | Unidirecional na prática; latência de plataforma; sem preços (iCal não expõe preço → `preco_total=0`) |
| Calendário unificado | ✅ | 520 linhas; sem drag-and-drop, sem multi-propriedade em timeline |
| Reservas + histórico de eventos | ✅ | Sólido |
| Hóspedes / CRM (tags, notas) | ✅ | Básico mas correto |
| Check-in online + OCR de documento | ✅ | `/api/documentos/extrair`; sem validação MRZ, sem liveness, sem assinatura |
| Export CSV SIBA | ✅ | Funcional |
| Submissão automática SIBA/AIMA | ❌ **Placeholder 501** | Vendido como existente |
| Concierge IA (Haiku 4.5) | ⚠️ Parcial | Gera texto; **não está ligado a nenhuma caixa de entrada** — o host copia e cola |
| Motor de preços (regras/tarifas/plataformas) | ✅ | Manual; sem dados de mercado |
| Relatórios (RevPAR, ocupação, YoY) | ✅ | Retrospetivo apenas; sem forecast, sem pace |
| Financeiro (despesas, comissões, lucro, CSV) | ✅ | Sem IVA, sem faturação, sem SAF-T |
| Automações | ⚠️ Mínimo | **3 gatilhos, 1 ação (email)**. Sem WhatsApp/SMS/push/tarefa |
| Site de reservas diretas por tenant | ⚠️ Neutralizado | `noindex`, sem domínio próprio |
| Blog por tenant | ✅ | Texto simples, sem markdown |
| Stripe Connect + checkout | ✅ | Auditado, idempotente, com reembolso em conflito. **Bom trabalho.** |
| Push notifications (web-push) | ✅ | |
| Admin/super-admin + MRR | ✅ | |
| Audit log | ⚠️ Parcial | Só ações sensíveis |
| RBAC / equipas | ❌ | Adiado deliberadamente |
| Unified inbox | ❌ | |
| App para limpezas | ❌ | |
| Faturação certificada | ❌ | |
| Dynamic pricing | ❌ | |
| API pública / webhooks | ❌ | |
| Multi-idioma no produto e no marketing | ❌ | Só PT (sites de tenant têm PT/EN parcial) |

### 4.2 Análise competitiva

| Concorrente | Preço (2026) | O que faz melhor | O que faz pior | Oportunidade |
|---|---|---|---|---|
| **Guesty** | Enterprise, ~$100+/unidade | Ligações API nativas a todas as OTAs; owner portal; trust accounting | Caro, complexo, overkill para 1–10 unidades; suporte PT inexistente | Todo o segmento SMB português |
| **Hostaway** | ~$50–100+/mês, com setup fee | Channel manager API real; marketplace de integrações | Contrato anual, setup fee, onboarding pesado | Sem compromisso, sem setup fee, ativo em 10 min |
| **Lodgify** | desde $20/listing/mês (min. $100 p/ 5) + 1.9 % | Website builder maduro, com domínio próprio e SEO | Preço por listing escala mal; dynamic pricing cobra 0.8 % por reserva | **Preço por conta, não por listing** — vantagem estrutural do Anfitrião |
| **Smoobu** | €26.10/mês +0.9 % ou €31.50 flat; dynamic pricing +€12.99/prop | Muito completo, forte na DACH; API Booking | Interface densa; PT é mercado secundário | Localização profunda PT |
| **Hospitable** | $0 → ~$29+/mês | **Melhor automação de mensagens do mercado**; auto-reply dentro do Airbnb | Sem revenue management; sem website; sem compliance EU | Copiar a qualidade da automação, ganhar no compliance |
| **OwnerRez** | ~$40+/mês | Melhor faturação/contratos/seguro dos EUA | 100 % centrado em EUA; UI datada | O equivalente PT não existe — construí-lo |
| **Hostfully** | ~$100+/mês | Guidebooks digitais excelentes | Caro, fragmentado | Guidebook é feature barata de copiar e muito visível |
| **Uplisting** | desde $20/listing (min. $100) | Fiabilidade, anti-double-booking | Caro para portfólios pequenos | Preço |
| **Amenitiz** | ~€100+/mês | Forte em Espanha/Portugal, força de vendas | Produto templated (anti-referência declarada); caro | Produto melhor a 1/4 do preço |
| **Chekin / EazyAL / GuestGrow** | €2–5/reserva ou ~€20/mês | **Já dominam o SEO de compliance PT** (SIBA, taxa turística, licenças) | Ferramentas de nicho, não são PMS | **Ameaça direta ao posicionamento escolhido — agir depressa** |

**Conclusão competitiva:** o Anfitrião não perde por preço (per-account é melhor que per-listing). Perde por **conectividade real às OTAs** e por **ausência de prova**. E o território que quer ocupar (compliance PT) **já está a ser ocupado no Google** por Chekin e EazyAL — que têm dezenas de artigos a rankear para "SIBA", "taxa turística [cidade]", "registo alojamento local". Essa janela fecha-se em 12–18 meses.

### 4.3 Funcionalidades em falta — priorizadas por impacto

| # | Funcionalidade | Impacto | Dific. | Prior. | Tempo |
|---|---|---|---|---|---|
| F1 | Faturação certificada PT (Vendus/InvoiceXpress/Moloni) + SAF-T | 🔴 Máximo | 6 | 10 | 3–4 sem |
| F2 | Módulo Taxa Turística municipal (cálculo, cobrança, mapa mensal) | 🔴 Máximo | 5 | 10 | 2–3 sem |
| F3 | Submissão SIBA real (ou RPA se API indisponível) | 🔴 Máximo | 7 | 10 | 3 sem + humano |
| F4 | Unified inbox (email + WhatsApp + OTA via forward) | 🔴 Máximo | 8 | 9 | 6 sem |
| F5 | Dynamic pricing com dados de mercado | 🔴 Alto | 8 | 9 | 6–8 sem |
| F6 | Módulo de limpezas + app de tarefas para equipa | 🟠 Alto | 6 | 9 | 4 sem |
| F7 | MB WAY + Multibanco (Ifthenpay/SIBS) | 🟠 Alto | 4 | 9 | 1–2 sem |
| F8 | Declaração INE mensal automática | 🟠 Alto | 4 | 8 | 1 sem |
| F9 | Livro de Reclamações + RNAL + seguro (cofre de compliance) | 🟠 Alto | 3 | 8 | 1 sem |
| F10 | Mapa fiscal IRS (Cat. B coef. 0.35 / Cat. F) + pack contabilista | 🟠 Alto | 4 | 8 | 2 sem |
| F11 | Domínio próprio + indexação dos sites de tenant | 🟠 Alto | 4 | 9 | 1 sem + €€ |
| F12 | Ligação API real Booking.com (Connectivity Partner) | 🟠 Alto | 9 | 8 | 3–6 meses |
| F13 | Ligação API real Airbnb | 🟠 Alto | 9 | 7 | 6–12 meses |
| F14 | RBAC / equipas (Clerk Organizations) | 🟡 Médio | 7 | 7 | 3 sem |
| F15 | Guidebook digital do alojamento | 🟡 Médio | 3 | 7 | 1 sem |
| F16 | Upsells ao hóspede (early check-in, late checkout, transfers) | 🟡 Médio | 5 | 7 | 2 sem |
| F17 | Owner portal (para gestores com proprietários) | 🟡 Médio | 6 | 6 | 3 sem |
| F18 | API pública + webhooks | 🟡 Médio | 5 | 5 | 2 sem |
| F19 | Fechaduras inteligentes (Nuki, TTLock, igloohome) | 🟡 Médio | 6 | 6 | 3 sem |
| F20 | Multi-idioma do produto (EN/ES) | 🟡 Médio | 5 | 6 | 2 sem |

---

## 5. Revenue Management

Área hoje **inexistente**. É o maior diferenciador não-compliance disponível, e o único que justifica subir preço.

### 5.1 O que construir

**RM1 — Preço dinâmico assistido (não automático).**
Descrição: motor que sugere preço por noite com base em ocupação própria, antecedência (booking window), dia de semana, sazonalidade, eventos locais e histórico. O host aprova em bloco ou por dia.
Problema que resolve: hosts portugueses fazem preço "de cabeça" e deixam 15–25 % de receita na mesa.
Impacto: +10–20 % RevPAR — mensurável e demonstrável. Justifica sozinho o plano Pro.
Dificuldade 8 · Prioridade 9 · Dependências: histórico de reservas ≥6 meses, dados de eventos · 6–8 semanas · Risco: sugestões más destroem confiança → **começar sempre com "sugestão", nunca com aplicação automática**.

**RM2 — Sinal de mercado.**
Comparação com alojamentos semelhantes na mesma zona (tipologia, capacidade, raio). Fonte: agregação anónima da própria base de clientes (efeito de rede — quanto mais clientes, melhor o produto) + dados públicos de eventos/feriados. **Nunca fazer scraping do Airbnb/Booking** — viola ToS e é risco legal.
Dificuldade 7 · Prioridade 8 · Dependências: massa crítica de ~200 propriedades · Risco: RGPD/concorrência → agregar com k-anonimato (mínimo 5 propriedades por célula).

**RM3 — Previsão de ocupação (30/60/90 dias).**
Pace e pickup: "estás 12 pp abaixo do mesmo período do ano passado para agosto". Este único gráfico é o que faz um host abrir a app todas as semanas.
Dificuldade 5 · Prioridade 9 · 2 semanas · Risco baixo.

**RM4 — Alertas de receita.**
"Faltam 21 dias para o fim de semana de 15/08 e tens 3 noites vazias. Baixa 12 % e a probabilidade de encher passa de 34 % para 71 %." Enviado por push/WhatsApp.
Dificuldade 4 · Prioridade 9 · Depende de RM3 · 1 semana.

**RM5 — Calendário inteligente.**
Heatmap de preço vs. ocupação, deteção de *orphan nights* (buracos de 1–2 noites entre reservas) com sugestão automática de desconto ou de min-stay ajustado. Ninguém no segmento SMB faz isto bem.
Dificuldade 5 · Prioridade 8 · 2 semanas.

**RM6 — Simulador de cenários.**
"E se baixar 10 % em setembro?" → impacto projetado em receita e ocupação. Fortíssimo em demonstração comercial.
Dificuldade 6 · Prioridade 6 · 2 semanas.

**RM7 — Relatório mensal automático.**
PDF/email no dia 1 com receita, ocupação, RevPAR, ADR, comissões pagas, lucro líquido, comparação YoY e 3 recomendações. **Ferramenta de retenção nº 1** e o artefacto que o host reencaminha ao contabilista (e que gera referências).
Dificuldade 3 · Prioridade 9 · 1 semana · Risco muito baixo. **Quick win.**

---

## 6. Automações — mapa completo

Hoje: 3 gatilhos × 1 ação. Alvo: motor de regras genérico **Gatilho → Condição → Ação → Atraso**.

### 6.1 Gatilhos a suportar
Reserva criada · reserva confirmada · reserva cancelada · reserva modificada · X dias antes do check-in · dia do check-in · check-in feito · check-in online **não** feito (crítico) · documento em falta · a meio da estadia · X horas antes do checkout · checkout feito · X dias após checkout · avaliação recebida · pagamento recebido · pagamento em atraso · noite órfã detetada · ocupação abaixo do limiar · SIBA por submeter a <24 h do prazo · taxa turística por declarar · limpeza não concluída · sincronização iCal falhada · dupla reserva detetada.

### 6.2 Ações a suportar
Email ao hóspede · **WhatsApp ao hóspede** (Meta Cloud API, templates aprovados) · SMS (fallback) · push ao anfitrião · email ao anfitrião · criar tarefa de limpeza · atribuir tarefa a membro da equipa · notificar equipa · gerar e enviar fatura · gerar e enviar recibo · pedir avaliação · submeter SIBA · marcar taxa turística · bloquear datas · ajustar preço · enviar código de fechadura · enviar guidebook · webhook HTTP · gerar resposta com IA e enviar.

### 6.3 Receitas prontas ("recipes") a incluir de origem
1. Reserva confirmada → email de boas-vindas + link de check-in online (imediato).
2. Check-in online não feito a 48 h → WhatsApp de lembrete; a 24 h → segundo lembrete + notificação ao anfitrião.
3. Check-in feito → SIBA submetido automaticamente + fatura emitida + código da fechadura enviado 2 h antes.
4. Dia do check-in → guidebook + contacto de emergência.
5. Meio da estadia → "está tudo bem?" (recuperação de reviews negativas **antes** de serem escritas — ROI enorme).
6. Checkout −3 h → instruções de saída.
7. Checkout feito → tarefa de limpeza criada e atribuída + taxa turística registada.
8. Checkout +1 dia → pedido de avaliação + convite para reserva direta com 10 % ("elimina a comissão na próxima").
9. Checkout +60 dias → campanha de regresso.
10. Noite órfã detetada → alerta ao anfitrião com sugestão de preço.

**Impacto:** as receitas 5 e 8 sozinhas alteram economia unitária do host (melhores reviews → melhor ranking OTA; reservas diretas → 0 % comissão). É a prova de valor mais fácil de vender.

---

## 7. Inteligência Artificial — onde aplicar

Já existe base (`@ai-sdk/anthropic`, Haiku 4.5 no concierge). O erro atual é usar IA como *gerador de texto isolado* em vez de *camada de execução*.

### 7.1 Alto impacto

1. **Auto-resposta com contexto real e aprovação em 1 toque.** Notificação push → resposta já redigida → "Enviar" ou "Editar". O ganho não é o texto, é não ter de abrir o Airbnb.
2. **Preenchimento de campos SIBA por OCR + validação MRZ.** Já há OCR; falta validar o checksum da zona de leitura mecânica do passaporte/CC e sinalizar documentos inválidos ou expirados **antes** da chegada.
3. **Auditor de conformidade.** Varre a conta e diz: "3 boletins por submeter (prazo em 14 h)", "taxa turística de junho por declarar", "licença AL não preenchida em 2 alojamentos", "seguro a expirar em 12 dias". Isto é um produto por si só.
4. **Redator de anúncios.** Gera título + descrição otimizados para Airbnb/Booking a partir dos dados do alojamento, em 6 idiomas. Alto valor percebido, custo trivial.
5. **Resposta a avaliações.** Especialmente a negativas — em tom que protege o ranking. Gera 3 opções por nível de firmeza.
6. **Tradução bidirecional em tempo real** na caixa de entrada.
7. **Explicação de números.** "Setembro caiu 18 %: 60 % explicado por menos reservas do Booking, 40 % por ADR mais baixo em dias de semana." Linguagem natural sobre os próprios dados.
8. **Deteção de hóspede de risco.** Sinais: reserva de última hora, 1 noite, local, grupo grande, sem histórico → alerta de festa potencial.
9. **Analisador de avaliações.** Agrega meses de reviews e devolve 3 ações concretas ("6 menções a Wi-Fi lento").
10. **Recomendação de preço com justificação em texto.**

### 7.2 Médio impacto
11. Geração do guidebook local a partir da morada. 12. FAQ automática por alojamento a partir do histórico de mensagens. 13. Categorização automática de despesas por foto de recibo. 14. Deteção de anomalias (consumos, gaps de calendário, reservas duplicadas). 15. Onboarding conversacional ("descreve o teu alojamento" → configuração pré-preenchida). 16. Resumo diário em voz. 17. Sugestão de resposta a pedidos de desconto com impacto em receita calculado. 18. Deteção de intenção de cancelamento. 19. Redação de posts de blog para o site do tenant. 20. Extração de dados de emails de reserva reencaminhados (ponte para OTAs sem API).

### 7.3 Diferenciadores ousados
21. **Agente de compliance autónomo**: com aprovação prévia, submete SIBA, emite faturas, declara taxa turística e prepara o INE — sozinho, com registo auditável. Este é o "preciso disto".
22. **Copiloto de conversa em chamada** (host ao telefone com hóspede estrangeiro).
23. **Simulador "quanto renderia este imóvel"** — ferramenta pública, gera leads e é conteúdo SEO de altíssima intenção.

**Governação obrigatória:** todas as ações de IA com efeito externo precisam de: (a) log auditável, (b) modo sugerir/aprovar antes de automático, (c) limite de custo por conta, (d) *kill switch*. Sem isto, o custo de IA e o risco reputacional escalam sem controlo.

---

## 8. Compliance Portugal — o fosso a construir

Esta secção é a razão pela qual o Anfitrião pode ganhar. Estado atual: **1 de 8 obrigações coberta, e essa parcialmente.**

| Obrigação | Base | Estado | Prioridade |
|---|---|---|---|
| **Boletim de alojamento (SIBA/AIMA)** — hóspedes estrangeiros, até 3 dias úteis após check-in; coima 100–2.000 € (singular) / 500–10.000 € (coletiva) | Lei 23/2007, art. 198.º | ⚠️ CSV manual; API é placeholder | 10 |
| **Faturação certificada + SAF-T + comunicação à AT** | CIVA / Dec-Lei 28/2019 | ❌ Inexistente | 10 |
| **Taxa turística municipal** — declaração e entrega mensais, regras diferentes por concelho | Regulamentos municipais | ❌ Inexistente | 10 |
| **INE** — inquérito mensal de permanência | Lei do SEN | ❌ Inexistente | 8 |
| **Livro de Reclamações Eletrónico** — obrigatório, com aviso visível no alojamento | Dec-Lei 74/2017 | ❌ Inexistente | 8 |
| **RNAL / número de registo** — obrigatório em toda a publicidade | Dec-Lei 128/2014 + Lei 56/2023 | ❌ Campo nem existe | 8 |
| **Seguro de responsabilidade civil** — obrigatório, com validade | Dec-Lei 128/2014 art. 13.º-A | ❌ Inexistente | 7 |
| **IRS Cat. B (coef. 0,35) / opção Cat. F** | CIRS | ❌ Inexistente | 7 |
| **RGPD** — consentimento, retenção, direito ao apagamento, registo de tratamentos | RGPD | ⚠️ Parcial (audit log limitado, retenção 30 dias anunciada) | 9 |

### 8.1 Especificações-chave

**C1 — SIBA automático a sério.**
Caminho A (preferível): credenciais de entidade junto da AIMA + integração oficial. **Bloqueado por ação humana** — é a única dependência humana verdadeiramente crítica do plano e deve ser iniciada já, em paralelo com todo o resto.
Caminho B (contingência, começar já): automação assistida do portal SIBA — o sistema prepara o ficheiro no formato exato do upload em lote do portal e guia o anfitrião num fluxo de 2 cliques, com confirmação de submissão e prova guardada. Cobre 90 % da dor sem depender da AIMA.
Impacto: elimina a maior ansiedade legal do host · Dificuldade 7 · Prioridade 10 · Risco: alteração unilateral do portal → mitigar com monitorização e fallback CSV.

**C2 — Cofre de compliance (o painel que ninguém tem).**
Um ecrã por alojamento com: número RNAL, licença, seguro (+data de expiração e alerta a 30 dias), Livro de Reclamações (link oficial + cartaz gerado em PDF para afixar), certificado energético, plano de segurança, livro de registo. Cada item com semáforo e data de validade.
Dificuldade 3 · Prioridade 9 · 1 semana. **É o melhor rácio impacto/esforço do plano inteiro.**

**C3 — Motor de taxa turística.**
Base de dados de regras por concelho (valor/noite, idade mínima, teto de noites, sazonalidade, isenções), cálculo automático por reserva, cobrança no checkout direto, mapa mensal pronto a submeter no portal municipal.
Dificuldade 5 · Prioridade 10 · 2–3 semanas · Risco: manter as regras atualizadas em 308 concelhos → começar pelos 12 que cobrem 80 % do AL (Lisboa, Porto, Albufeira, Portimão, Loulé, Lagos, Faro, Cascais, Sintra, Vila Nova de Gaia, Funchal, Óbidos).

**C4 — Faturação certificada.**
Não construir de raiz (certificação AT é um processo pesado). **Integrar** com Vendus / InvoiceXpress / Moloni via API: fatura-recibo emitida automaticamente no check-in ou no pagamento, enviada ao hóspede, e SAF-T disponível ao contabilista.
Dificuldade 6 · Prioridade 10 · 3–4 semanas · Risco: dependência de terceiro → abstrair atrás de um `InvoicingAdapter`.

**C5 — Check-in de nível superior.**
Ao OCR existente juntar: validação MRZ com checksum, deteção de documento expirado, *liveness* leve (selfie vs. foto do documento) e **assinatura digital do contrato de alojamento** com selo temporal e IP. Isto transforma o check-in de "recolha de dados" em "prova legal".
Dificuldade 7 · Prioridade 8 · 3 semanas · Risco RGPD: dados biométricos são categoria especial (art. 9.º) → **exige consentimento explícito, minimização e apagamento imediato após verificação**. Decisão atual de não persistir a foto está correta e deve manter-se.

**C6 — RGPD a sério.**
Registo de atividades de tratamento, política de retenção aplicada por código (não por promessa na landing), exportação e apagamento de dados do hóspede a pedido, consentimentos versionados, encriptação em repouso dos campos de documento, e log de acesso a dados sensíveis. **Com dados de passaporte na base, isto não é opcional.**
Dificuldade 6 · Prioridade 9 · 2–3 semanas.

---

## 9. Funcionalidades premium — "preciso disto"

| # | Ideia | Porque provoca a reação |
|---|---|---|
| P1 | **Piloto automático de conformidade** — tudo o que é legal, feito sozinho, com relatório mensal de prova | Vende sossego, não software |
| P2 | **Seguro de multa** — se o SIBA falhar por culpa da plataforma, a plataforma paga a coima | Inversão total de risco. Nenhum concorrente ousa |
| P3 | **Relatório para o contabilista** — 1 clique, tudo o que o contabilista pede | O contabilista passa a recomendar a plataforma |
| P4 | **Botão "reserva direta" para o hóspede repetente** com desconto financiado pela comissão poupada | Converte OTA em direto de forma mensurável |
| P5 | **Modo Férias** — o host vai de férias; automações assumem tudo e escalam só o crítico | Alívio emocional puro |
| P6 | **Cofre de códigos** — fechadura, Wi-Fi, alarme, com rotação e envio programado | Segurança + conveniência |
| P7 | **Marketplace de limpezas** — encontrar equipa verificada na zona | Resolve o pior problema operacional |
| P8 | **Avaliação de risco pré-chegada** | Evita a festa que custa 3.000 € |
| P9 | **Concorrência na minha rua** — preço e ocupação médios da zona | Vício de utilização diária |
| P10 | **Contas de proprietário** — repartição automática de receitas | Abre o segmento de gestão profissional |
| P11 | **Simulador público "quanto rende o meu T2 em Faro"** | Máquina de leads + SEO |
| P12 | **Migração assistida em 1 clique** desde Smoobu/Lodgify/Excel | Remove a maior fricção de troca |
| P13 | **Modo Inspeção ASAE** — dossier completo em PDF, pronto para fiscalização | Momento de pânico → momento de gratidão |
| P14 | **Guest App sem instalação** (PWA por reserva): check-in, guidebook, códigos, upsells, chat | Experiência de hóspede de nível hotel |
| P15 | **Widget de reservas embebível** para quem já tem site | Distribuição viral |

---

## 10. Design & motion

Regra: **motion nativo, zero bibliotecas de animação em JS.**

| Efeito | Onde | Custo |
|---|---|---|
| View Transitions API | transições entre páginas | ~0 (nativo Next 16) |
| `animation-timeline: view()` | revelação de secções no scroll | 0 JS |
| Contadores animados | KPIs em Hoje/Relatórios | trivial |
| Gradiente de malha subtil em movimento lento | hero | CSS puro, `prefers-reduced-motion` |
| Cursor spotlight nos cards | features da landing | CSS vars + 1 listener |
| Sucesso: check-in concluído | animação de selo + haptic | pequeno |
| Barras/áreas com desenho progressivo | gráficos | SVG `stroke-dasharray` |
| Skeletons com shimmer | todas as listas | CSS |
| Transição fluida no calendário | mudança de mês | View Transitions |
| Optimistic UI | confirmar reserva, marcar tarefa | lógica, não animação |
| Toast com progresso | sincronização iCal | `sonner` já instalado |

Obrigatório: respeitar `prefers-reduced-motion` em tudo, e **nenhuma animação pode atrasar o LCP ou causar CLS**.

---

## 11. Dashboard — redesenho conceptual

Referências: Linear (densidade + velocidade), Stripe (hierarquia de números), Raycast (comando), Vercel (calma).

**"Hoje" deve ser a única página que 80 % dos utilizadores abre.** Estrutura proposta:

```
┌──────────────────────────────────────────────┐
│  Bom dia, Vasco.            Sáb, 27 jul      │
│                                              │
│  ⚠  2 boletins SIBA por submeter · 14 h      │  ← barra de conformidade
│                                              │
│  CHEGAM HOJE (2)                             │
│  ┌────────────────────────────────────────┐  │
│  │ Maria Silva · Casa do Vale · 15:00     │  │
│  │ ✓ check-in online  ✓ pago  ⚠ SIBA      │  │
│  │ [Enviar código]  [Submeter SIBA]       │  │  ← ação, não informação
│  └────────────────────────────────────────┘  │
│                                              │
│  SAEM HOJE (1)  ·  LIMPEZAS (1 por atribuir) │
│                                              │
│  ─────────────────────────────────────────   │
│  Julho        4.820 €    ▲ 12 % vs 2025      │
│  Ocupação       78 %     Agosto: 64 % (−9pp) │  ← 1 alerta accionável
│                                              │
│  💡 3 noites vazias em 15–17 ago.            │
│     Baixar 12 % → 71 % de probabilidade      │
│     [Aplicar]  [Ignorar]                     │
└──────────────────────────────────────────────┘
```

Princípios:
1. **Cada cartão termina numa ação**, nunca só em informação.
2. **Um número dominante por ecrã.**
3. **Command palette (⌘K)** — já existe `global-search.tsx`; promover a barra de comandos completa (navegar, criar, executar).
4. **Densidade configurável** (compacto/confortável) — o gestor de 10 unidades e o dono de 1 T1 não querem o mesmo.
5. **Estados vazios que ensinam**, com dados de exemplo desligáveis.
6. **Tudo abre em <100 ms percebidos** — prefetch agressivo, dados no servidor, streaming.

---

## 12. Pricing — análise e proposta

### 12.1 Problemas do modelo atual (Trial 14 d · Starter €19/3 · Pro €39/10)

1. **Sem tier gratuito permanente** — não há topo de funil de produto e não há efeito de rede.
2. **Trial de 14 dias é curto para um negócio sazonal.** Deve ser 30 dias, ou baseado em uso ("até à tua 5.ª reserva").
3. **Subvalorizado.** Smoobu custa €26/mês *por propriedade*. O Pro a €39 para 10 propriedades é ~€3.90/unidade — sinaliza "barato", não "premium". Está a deixar dinheiro e posicionamento em cima da mesa.
4. **Salto brutal 3→10 propriedades** sem degrau intermédio.
5. **Sem eixo de valor além da contagem de propriedades** — nada monetiza IA, compliance ou revenue management, que são o custo marginal real e o valor real.
6. **Sem plano para empresas de gestão** (o segmento com maior LTV).
7. **Sem add-ons, sem upsells, sem serviços.**

### 12.2 Proposta

| Plano | Preço | Limite | Inclui |
|---|---|---|---|
| **Grátis** | 0 € | 1 alojamento, 5 reservas/mês | Calendário, iCal, check-in online, export SIBA, marca Anfitrião no site |
| **Essencial** | **29 €/mês** (24 € anual) | até 2 | Tudo do Grátis + reservas ilimitadas, automações, faturação, taxa turística, IA básica |
| **Profissional** ⭐ | **59 €/mês** (49 € anual) | até 6 | + SIBA automático, revenue management, unified inbox, site com domínio próprio, IA ilimitada, INE |
| **Negócio** | **119 €/mês** (99 € anual) | até 20 | + equipas/RBAC, owner portal, app de limpezas, API, relatórios avançados, suporte prioritário |
| **Empresa** | sob consulta | 20+ | + SLA, gestor dedicado, migração assistida, marca branca, formação |

**Add-ons:** Revenue Management Pro (+15 €/mês) · WhatsApp Business (+9 €/mês + custo de conversa) · SMS (consumo) · Domínio próprio (+5 €/mês) · Fechaduras inteligentes (+7 €/mês) · Alojamento extra (+8 €/mês) · **Pack Contabilista** (+19 €/mês, inclui SAF-T e mapa fiscal).

**Racional:**
- Preço **por conta**, não por propriedade: mantém a vantagem estrutural sobre Lodgify/Uplisting e é a mensagem comercial mais forte que existe ("eles cobram por apartamento, nós não").
- Ancoragem: subir de €19 para €29 mantém-se muito abaixo de Smoobu e sinaliza qualidade.
- **0 % de comissão sobre reservas** deve virar bandeira permanente (Smoobu cobra 0,9 %, Lodgify 1,9 %).

**Upsells/cross-sells:** seguro AL (comissão de parceiro) · faturação certificada (revenda) · fotografia profissional (marketplace, fase humana) · limpezas (marketplace) · domínios (revenda) · **programa de afiliados para contabilistas** (20 % recorrente — o canal com melhor CAC neste mercado).

**LTV:** com churn mensal de 3 % e ARPU de €45, LTV ≈ €1.500. Justifica CAC até €300–400. Nada no plano atual está a explorar isso.

---

## 13. SEO

### 13.1 Estado

✅ Metadata correta, OG dinâmico (`/api/og`), JSON-LD `SoftwareApplication` + `FAQPage`, canonical, robots/sitemap corrigidos (estavam bloqueados pelo middleware do Clerk — bug crítico, bem apanhado).
❌ **Não há blog institucional** (decisão explícita de o deixar fora de âmbito). **Não há landing pages secundárias. Não há programmatic SEO. Não há conteúdo.**

Resultado: o site tem 1 página indexável a competir com Chekin, EazyAL, Lodgify PT e Host Wise, que têm centenas.

### 13.2 O que fazer

**Cluster de conformidade (o mais valioso — alta intenção, baixa concorrência real):**
`/guias/siba-boletim-alojamento` · `/guias/taxa-turistica` + **uma página por concelho** (~40 páginas: Lisboa, Porto, Albufeira, Portimão, Loulé, Lagos, Faro, Cascais, Sintra, Funchal, Óbidos…) · `/guias/registo-alojamento-local` · `/guias/irs-alojamento-local` · `/guias/seguro-alojamento-local` · `/guias/livro-reclamacoes-alojamento-local` · `/guias/inquerito-ine`.

**Cluster de comparação (alta intenção comercial):**
`/vs/smoobu` · `/vs/lodgify` · `/vs/guesty` · `/vs/hostaway` · `/vs/amenitiz` · `/vs/hospitable` · `/alternativas/[concorrente]`.

**Programmatic SEO (o maior ativo de longo prazo):**
`/rendimento/[cidade]/[tipologia]` — "Quanto rende um T2 em Albufeira" com dados agregados reais. ~1.500 combinações. Cada página termina no simulador → captura de lead. **Requer dados próprios, o que a torna impossível de copiar.**

**Técnico:** `hreflang` quando entrar EN/ES · schema `Article`+`FAQPage` em cada guia · schema `Product`+`AggregateRating` (após ter reviews) · breadcrumbs · ligação interna sistemática guia→produto · **reativar `index` nos sites `/r/[slug]`** (cada tenant passa a ser um backlink e um sinal de marca).

---

## 14. Performance

| Área | Risco | Ação |
|---|---|---|
| Bundle | `precos` 1474 L, `relatorios` 716 L, `calendario` 520 L como client components prováveis | Server Components por omissão; `dynamic()` para tabelas e gráficos |
| Fontes | 2 famílias Google Fonts | Self-host, `font-display: swap`, subset latin |
| Imagens | Vercel Blob + `next/image` ok | Garantir AVIF/WebP, `sizes` correto, blur placeholder |
| LCP | Hero é texto — bom. Ao adicionar screenshot, **priorizar** | `priority` + dimensões explícitas (evitar CLS) |
| Ícones | `lucide-react` completo | Importações nomeadas (tree-shaking) — verificar |
| Rate limit | **Em memória — não funciona em serverless** | Upstash Redis. 🔴 |
| Queries | `.eq('owner_id')` manual em ~20 rotas; provável N+1 nos relatórios | Índices compostos `(owner_id, data)`; agregações em SQL/vistas materializadas |
| iCal sync | Síncrono no pedido | Fila (QStash/Inngest) + backoff + estado por feed |
| Cache | Aparentemente ausente | `revalidate` nas páginas públicas; `unstable_cache` nos relatórios |
| Monitorização | **Inexistente** | Sentry + Vercel Analytics + Speed Insights. Sem isto não há como saber se algo disto funcionou |

---

## 15. Segurança e escalabilidade (não pedido, mas bloqueante)

| # | Risco | Gravidade | Ação |
|---|---|---|---|
| S1 | RLS por JWT nunca ligado; isolamento só por código de aplicação | 🔴 Crítico | Ligar Clerk JWT template + políticas RLS reais como **defesa em profundidade**. Já houve 2 incidentes. |
| S2 | Rate limit em memória | 🔴 Crítico | Upstash Redis |
| S3 | Dados de documento (passaporte/CC) em claro | 🔴 Crítico | Encriptação ao nível da coluna + log de acesso |
| S4 | Testes E2E manuais em produção com prefixo `TESTE-E2E` | 🟠 Alto | Playwright em CI contra ambiente de preview + branch Supabase |
| S5 | Sem monitorização de erros | 🟠 Alto | Sentry |
| S6 | Sem backups verificados / plano de recuperação | 🟠 Alto | PITR Supabase + restauro testado trimestralmente |
| S7 | Auto-deploy GitHub→Vercel partido | 🟡 Médio | Reparar; deploy manual não escala |
| S8 | Sem 2FA | 🟡 Médio | Ativar MFA no Clerk (config, não código) |
| S9 | Sem staging | 🟡 Médio | Preview + branch de BD |
| S10 | Cobertura de testes fina (~10 ficheiros para 12,5k linhas) | 🟡 Médio | Alvo 60 % nas libs de dinheiro/datas/compliance |

---

# ROADMAP

**Regra aplicada:** tudo o que é software primeiro; tudo o que exige intervenção humana (fotografias, vídeo, conteúdos escritos por pessoas, contactos comerciais, contratos, jurídico, offline) fica no fim — **exceto o pedido de credenciais à AIMA, que deve ser iniciado no dia 1 porque tem lead time longo e não bloqueia nada enquanto corre.**

---

## FASE 1 — Quick Wins (semanas 1–4)
*Alto impacto, baixo esforço. Tudo software.*

| # | Tarefa | Dific. | Prior. | Tempo | Risco |
|---|---|---|---|---|---|
| 1.1 | 🔴 **Corrigir copy enganosa** (SIBA "automático", "elimina duplas reservas", promessa do site direto) | 1 | 10 | 2 h | Nenhum. Não fazer isto é risco legal |
| 1.2 | 🔴 Rate limit em Redis (Upstash) | 3 | 10 | 1 d | Baixo |
| 1.3 | 🔴 Sentry + Vercel Analytics + Speed Insights | 2 | 10 | 1 d | Nenhum |
| 1.4 | 🔴 PostHog: funil de onboarding, ativação, uso de features | 3 | 10 | 2 d | Nenhum |
| 1.5 | 🔴 **Cofre de compliance** (RNAL, licença, seguro, Livro de Reclamações + cartaz PDF, alertas de validade) | 3 | 10 | 5 d | Baixo |
| 1.6 | 🔴 Ligar RLS real via Clerk JWT (defesa em profundidade) | 5 | 10 | 4 d | Médio — testar exaustivamente |
| 1.7 | Screenshots reais do produto na landing (gerados por código, sem fotógrafo) | 2 | 10 | 2 d | Nenhum |
| 1.8 | Reescrever headline/subheadline para ângulo de conformidade | 1 | 10 | 4 h | Nenhum |
| 1.9 | Calculadora de comissões → topo da página + captura de email | 2 | 9 | 1 d | Nenhum |
| 1.10 | Plano Grátis permanente + trial 30 dias | 2 | 9 | 2 d | Baixo |
| 1.11 | Novos escalões de preço (Essencial/Profissional/Negócio) | 3 | 9 | 3 d | Médio — grandfathering dos atuais |
| 1.12 | Garantia "30 dias ou devolvemos" | 1 | 9 | 2 h | Baixo |
| 1.13 | Checklist de onboarding + estados vazios com ação | 3 | 9 | 4 d | Nenhum |
| 1.14 | Relatório mensal automático por email (PDF) | 3 | 9 | 4 d | Baixo |
| 1.15 | Reduzir navegação de 13 → 6 destinos | 4 | 8 | 4 d | Médio — testar com utilizadores |
| 1.16 | Reativar `index` nos sites `/r/[slug]` + Vercel Pro para domínio próprio | 2 | 9 | 1 d + orçamento | Baixo |
| 1.17 | Declaração INE mensal | 4 | 8 | 5 d | Baixo |
| 1.18 | Alertas de noites órfãs | 4 | 8 | 3 d | Baixo |
| 1.19 | Command palette ⌘K completo | 3 | 7 | 3 d | Nenhum |
| 1.20 | Motion nativo (View Transitions, scroll animations, contadores) | 3 | 7 | 4 d | Baixo |
| 1.21 | Páginas `/vs/[concorrente]` × 6 | 2 | 8 | 4 d | Baixo |
| 1.22 | Vídeo de produto de 60 s (screen recording + narração TTS, sem equipa) | 3 | 9 | 3 d | Nenhum |

**Ganhos esperados da Fase 1:** conversão da landing +80–150 % (prova visual + preço + garantia + headline); risco legal eliminado; visibilidade operacional a partir do zero; primeira feature verdadeiramente única (cofre de compliance) no mercado.

---

## FASE 2 — Melhorias estruturais (semanas 5–14)

| # | Tarefa | Dific. | Prior. | Tempo | Dependências |
|---|---|---|---|---|---|
| 2.1 | 🔴 **Faturação certificada** (adapter + Vendus/InvoiceXpress/Moloni) | 6 | 10 | 4 sem | Contas de parceiro |
| 2.2 | 🔴 **Motor de taxa turística** (12 concelhos principais) | 5 | 10 | 3 sem | — |
| 2.3 | 🔴 **SIBA — automação assistida do portal** (contingência do caminho A) | 7 | 10 | 3 sem | — |
| 2.4 | 🔴 Encriptação de campos de documento + log de acesso | 6 | 9 | 2 sem | 1.6 |
| 2.5 | 🔴 Motor de automações genérico (gatilho/condição/ação/atraso) | 7 | 9 | 4 sem | — |
| 2.6 | 🔴 WhatsApp Business (Meta Cloud API) | 6 | 9 | 3 sem | 2.5, verificação Meta |
| 2.7 | MB WAY + Multibanco (Ifthenpay) | 4 | 9 | 2 sem | Contrato PSP |
| 2.8 | Módulo de limpezas + app de tarefas (PWA para equipa) | 6 | 9 | 4 sem | 2.5 |
| 2.9 | RBAC / Clerk Organizations | 7 | 8 | 3 sem | 1.6 |
| 2.10 | Fila para sincronização iCal (QStash/Inngest) + retry + estado | 5 | 8 | 2 sem | — |
| 2.11 | Playwright em CI + branch Supabase (fim dos testes em produção) | 5 | 8 | 2 sem | — |
| 2.12 | Redesenho do "Hoje" orientado a ações | 5 | 9 | 3 sem | 1.15 |
| 2.13 | Refactor de `precos` (1474 L) em módulos | 5 | 7 | 2 sem | — |
| 2.14 | Mapa fiscal IRS + Pack Contabilista | 4 | 8 | 2 sem | 2.1 |
| 2.15 | Sistema de design: escala de terracota, tipografia, tabular nums, dark mode intencional | 4 | 8 | 2 sem | — |
| 2.16 | RGPD: registo de tratamentos, retenção por código, export/apagamento | 6 | 9 | 3 sem | — |

---

## FASE 3 — Funcionalidades diferenciadoras (semanas 15–28)

| # | Tarefa | Dific. | Prior. | Tempo |
|---|---|---|---|---|
| 3.1 | **Unified inbox** (email + WhatsApp + ponte por reencaminhamento OTA) | 8 | 9 | 6 sem |
| 3.2 | **Revenue Management v1** (forecast, pace, sugestão de preço, alertas) | 8 | 9 | 8 sem |
| 3.3 | Check-in premium (MRZ + liveness + assinatura digital com selo temporal) | 7 | 8 | 4 sem |
| 3.4 | Guest App (PWA por reserva: check-in, guidebook, códigos, upsells, chat) | 6 | 8 | 4 sem |
| 3.5 | Upsells ao hóspede (early/late, transfers, limpeza extra) | 5 | 7 | 3 sem |
| 3.6 | Guidebook digital gerado por IA | 4 | 7 | 2 sem |
| 3.7 | Owner portal + repartição de receitas | 6 | 7 | 4 sem |
| 3.8 | Migração em 1 clique (Smoobu, Lodgify, CSV, Excel) | 6 | 8 | 3 sem |
| 3.9 | Fechaduras inteligentes (Nuki, TTLock, igloohome) | 6 | 6 | 3 sem |
| 3.10 | Programmatic SEO `/rendimento/[cidade]/[tipologia]` | 6 | 8 | 4 sem |
| 3.11 | **Booking.com Connectivity Partner** — candidatura + adapter | 9 | 8 | 3–6 meses |
| 3.12 | API pública + webhooks | 5 | 6 | 3 sem |
| 3.13 | Modo Inspeção ASAE (dossier PDF) | 3 | 7 | 1 sem |

---

## FASE 4 — IA (semanas 24–40, sobrepõe-se à Fase 3)

| # | Tarefa | Dific. | Prior. | Tempo |
|---|---|---|---|---|
| 4.1 | Auto-resposta com contexto + aprovação em 1 toque | 6 | 10 | 4 sem |
| 4.2 | **Auditor de conformidade por IA** | 5 | 10 | 3 sem |
| 4.3 | Explicação de números em linguagem natural | 5 | 8 | 2 sem |
| 4.4 | Redator de anúncios multilingue | 3 | 8 | 1 sem |
| 4.5 | Resposta a avaliações (3 níveis de tom) | 3 | 8 | 1 sem |
| 4.6 | Analisador de avaliações → 3 ações | 5 | 7 | 2 sem |
| 4.7 | Deteção de hóspede de risco | 6 | 7 | 3 sem |
| 4.8 | Recomendação de preço com justificação | 7 | 8 | 3 sem |
| 4.9 | Onboarding conversacional | 5 | 7 | 2 sem |
| 4.10 | Categorização de despesas por foto de recibo | 4 | 6 | 2 sem |
| 4.11 | **Agente de compliance autónomo** (com aprovação e log auditável) | 9 | 9 | 8 sem |
| 4.12 | Governação de IA (limites de custo, kill switch, auditoria) | 4 | 10 | 1 sem — **antes de tudo o resto desta fase** |

---

## FASE 5 — Escalabilidade e expansão (semanas 40+)

| # | Tarefa | Dific. | Prior. |
|---|---|---|---|
| 5.1 | Multi-idioma do produto e marketing (EN, ES) | 5 | 8 |
| 5.2 | Expansão Espanha (parte viajero/SES.HOSPEDAJES, IVA, turística autonómica) | 8 | 8 |
| 5.3 | Expansão Itália (Alloggiati Web, ISTAT, cedolare secca) | 8 | 7 |
| 5.4 | Airbnb API oficial | 9 | 7 |
| 5.5 | Multi-região de BD + read replicas | 7 | 6 |
| 5.6 | Marca branca para empresas de gestão | 6 | 6 |
| 5.7 | Marketplace de integrações | 7 | 5 |
| 5.8 | SOC 2 / ISO 27001 | 8 | 5 |
| 5.9 | App nativa (se as métricas de PWA a justificarem) | 7 | 4 |

---

## FASE H — Dependências humanas (arrancar em paralelo, executar no fim)

| # | Tarefa | Quando iniciar | Porquê |
|---|---|---|---|
| H1 | **Credenciais e documentação técnica da API SIBA junto da AIMA** | 🔴 **Dia 1** | Lead time longo; não bloqueia nada enquanto corre; a Fase 2.3 é a contingência |
| H2 | Contratos com Vendus/InvoiceXpress/Moloni | Semana 4 | Bloqueia 2.1 |
| H3 | Contrato Ifthenpay/SIBS (MB WAY) | Semana 6 | Bloqueia 2.7 |
| H4 | Verificação Meta Business (WhatsApp) | Semana 6 | Bloqueia 2.6 |
| H5 | Decisão de orçamento: Vercel Pro + Supabase Pro | Semana 1 | Bloqueia 1.16 |
| H6 | Decisão de marca: `anfitriao.pt` vs `anfitrioes.pt` | Semana 1 | Afeta SEO e todo o material |
| H7 | Recolha dos primeiros 10 testemunhos reais (entrevistas) | Após 20 clientes | Insubstituível por software |
| H8 | Case studies com números reais | Após 3 meses de dados | — |
| H9 | Candidatura a Booking Connectivity Partner | Semana 12 | Bloqueia 3.11 |
| H10 | Revisão jurídica (RGPD, T&C, biometria, responsabilidade) | Antes da Fase 3.3 | Risco legal |
| H11 | Programa de afiliados para contabilistas | Semana 16 | Melhor canal de CAC |
| H12 | Fotografia/vídeo profissional de marca | Após product-market fit | Último — o vídeo de 1.22 chega até lá |
| H13 | Parcerias com associações de AL (ALEP) | Semana 20 | Distribuição |

---

# BACKLOG DE PRODUTO (estilo Jira)

Prioridade = valor de negócio ÷ esforço. `P0` = bloqueante, `P1` = alto, `P2` = médio, `P3` = baixo.

---

### ÉPICO ANF-1 — Integridade e Confiança `P0`
> *Deixar de prometer o que não se entrega e proteger dados sensíveis.*

| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-1.1 | Task | Auditar e corrigir toda a copy sobre SIBA na landing, metadata, OG e FAQ | P0 | 2 h |
| ANF-1.2 | Task | Corrigir claim "elimina duplas reservas" → "reduz o risco"; explicar latência iCal | P0 | 1 h |
| ANF-1.3 | Task | Corrigir/qualificar a promessa do site de reservas diretas | P0 | 1 h |
| ANF-1.4 | Story | Ligar Clerk JWT template e políticas RLS por `owner_id` em todas as tabelas | P0 | 4 d |
| ANF-1.5 | Story | Remover código morto de auth (`getSupabaseForRequest`) após 1.4 | P0 | 4 h |
| ANF-1.6 | Story | Rate limit distribuído (Upstash Redis) em todas as rotas públicas | P0 | 1 d |
| ANF-1.7 | Story | Encriptação ao nível de coluna dos campos de documento de hóspede | P0 | 5 d |
| ANF-1.8 | Story | Log de acesso a dados sensíveis (quem leu que boletim, quando) | P0 | 3 d |
| ANF-1.9 | Task | Ativar MFA no Clerk | P1 | 2 h |
| ANF-1.10 | Story | Política de retenção aplicada por código (não por promessa) | P1 | 3 d |
| ANF-1.11 | Story | Export e apagamento de dados do hóspede a pedido (RGPD art. 15/17) | P1 | 4 d |
| ANF-1.12 | Story | Registo de atividades de tratamento | P1 | 3 d |

---

### ÉPICO ANF-2 — Observabilidade `P0`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-2.1 | Story | Sentry (erros + performance) em cliente e servidor | P0 | 1 d |
| ANF-2.2 | Story | PostHog: funil sign-up → 1.ª propriedade → 1.º iCal → 1.ª reserva → 1.º check-in | P0 | 2 d |
| ANF-2.3 | Story | Vercel Analytics + Speed Insights | P0 | 2 h |
| ANF-2.4 | Story | Dashboard interno de saúde (sincronizações falhadas, SIBA pendente, erros de pagamento) | P1 | 3 d |
| ANF-2.5 | Story | Alertas para o Slack/email do fundador em eventos críticos | P1 | 1 d |
| ANF-2.6 | Story | Definir e instrumentar a métrica-norte: *reservas geridas por semana ativa* | P1 | 2 d |

---

### ÉPICO ANF-3 — Conversão da Landing `P0`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-3.1 | Story | Nova headline/subheadline com ângulo de conformidade | P0 | 4 h |
| ANF-3.2 | Story | Screenshots reais do produto (Hoje, Calendário, Check-in, Relatórios) no hero e nas features | P0 | 2 d |
| ANF-3.3 | Story | Vídeo de produto 60 s (screen recording + narração) | P0 | 3 d |
| ANF-3.4 | Story | Calculadora de comissões movida para o hero + captura de email | P0 | 1 d |
| ANF-3.5 | Story | Garantia de 30 dias, visível junto de cada CTA | P0 | 2 h |
| ANF-3.6 | Story | Secção de comparação Anfitrião vs Smoobu/Lodgify/Guesty (preço por conta vs por listing) | P1 | 2 d |
| ANF-3.7 | Story | FAQ reescrita para objeções comerciais (não operacionais) | P1 | 4 h |
| ANF-3.8 | Story | Banda de confiança: "Feito em Portugal", RGPD, 0 % comissão, sem contrato | P1 | 4 h |
| ANF-3.9 | Story | CTA secundário de baixo compromisso ("Ver demonstração") | P1 | 4 h |
| ANF-3.10 | Story | Live chat / widget de suporte | P1 | 1 d |
| ANF-3.11 | Story | Substituir "cenários" por testemunhos reais | P1 | *bloqueado por H7* |
| ANF-3.12 | Story | Contador social ("X anfitriões, Y reservas geridas") assim que os números forem defensáveis | P2 | 1 d |
| ANF-3.13 | Task | Decidir e consolidar a marca (`anfitriao` vs `anfitrioes`) | P1 | *humano* |

---

### ÉPICO ANF-4 — Compliance Portugal `P0` ⭐ *o fosso*
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-4.1 | Story | Cofre de compliance por alojamento (RNAL, licença, seguro, certificado energético) com semáforos e validades | P0 | 5 d |
| ANF-4.2 | Story | Livro de Reclamações: registo do link oficial + cartaz PDF gerado para afixar | P0 | 2 d |
| ANF-4.3 | Story | Alertas de expiração (seguro, licença, documentos) por push e email | P0 | 2 d |
| ANF-4.4 | Epic-link | **Taxa turística**: base de regras por concelho (12 principais) | P0 | 1 sem |
| ANF-4.5 | Story | Cálculo automático da taxa por reserva + cobrança no checkout direto | P0 | 1 sem |
| ANF-4.6 | Story | Mapa mensal de taxa turística pronto a submeter, por concelho | P0 | 1 sem |
| ANF-4.7 | Story | SIBA: automação assistida do portal (upload em lote guiado + prova de submissão) | P0 | 3 sem |
| ANF-4.8 | Story | SIBA: painel de estado por reserva com contagem decrescente para o prazo de 3 dias úteis | P0 | 3 d |
| ANF-4.9 | Story | SIBA: implementar `submitBookingToSiba` real | P0 | *bloqueado por H1* |
| ANF-4.10 | Epic-link | **Faturação**: `InvoicingAdapter` + integração Vendus/InvoiceXpress/Moloni | P0 | 4 sem |
| ANF-4.11 | Story | Emissão automática de fatura-recibo no check-in ou pagamento | P0 | 1 sem |
| ANF-4.12 | Story | Exportação SAF-T e mapa para o contabilista | P1 | 1 sem |
| ANF-4.13 | Story | Declaração INE mensal (recolha + ficheiro/submissão) | P1 | 1 sem |
| ANF-4.14 | Story | Mapa fiscal IRS: Cat. B (coef. 0,35) vs Cat. F, com simulação comparativa | P1 | 2 sem |
| ANF-4.15 | Story | Modo Inspeção ASAE — dossier completo em PDF | P2 | 1 sem |

---

### ÉPICO ANF-5 — Automação e Mensagens `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-5.1 | Story | Motor genérico: gatilho + condição + ação + atraso | P1 | 3 sem |
| ANF-5.2 | Story | 23 gatilhos (ver §6.1) | P1 | 1 sem |
| ANF-5.3 | Story | 20 ações (ver §6.2) | P1 | 2 sem |
| ANF-5.4 | Story | Integração WhatsApp Business (Meta Cloud API) com templates | P1 | 3 sem |
| ANF-5.5 | Story | 10 receitas prontas, ativáveis num clique | P1 | 1 sem |
| ANF-5.6 | Story | Construtor visual de automações com pré-visualização | P1 | 2 sem |
| ANF-5.7 | Story | Registo de automações com estado de entrega e reenvio | P1 | 1 sem |
| ANF-5.8 | Story | SMS como fallback quando o WhatsApp falha | P2 | 1 sem |
| ANF-5.9 | Story | Variáveis por idioma do hóspede | P2 | 3 d |

---

### ÉPICO ANF-6 — Revenue Management `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-6.1 | Story | Previsão de ocupação 30/60/90 dias com pace vs. ano anterior | P1 | 2 sem |
| ANF-6.2 | Story | Deteção de noites órfãs + sugestão de desconto | P1 | 1 sem |
| ANF-6.3 | Story | Alertas de receita (push/WhatsApp) com ação sugerida | P1 | 1 sem |
| ANF-6.4 | Story | Motor de sugestão de preço (aprovação obrigatória) | P1 | 6 sem |
| ANF-6.5 | Story | Sinal de mercado agregado e anonimizado (k≥5) | P1 | 4 sem |
| ANF-6.6 | Story | Calendário-heatmap preço × ocupação | P1 | 2 sem |
| ANF-6.7 | Story | Relatório mensal automático em PDF por email | P0 | 4 d |
| ANF-6.8 | Story | Simulador de cenários | P2 | 2 sem |

---

### ÉPICO ANF-7 — Caixa de Entrada Unificada `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-7.1 | Story | Modelo de dados de conversa (thread, mensagem, canal, hóspede, reserva) | P1 | 1 sem |
| ANF-7.2 | Story | Canal email (Resend inbound) | P1 | 2 sem |
| ANF-7.3 | Story | Canal WhatsApp | P1 | *depende de 5.4* |
| ANF-7.4 | Story | Ponte OTA por reencaminhamento de email + extração por IA | P1 | 2 sem |
| ANF-7.5 | Story | Concierge ligado à conversa (deixa de ser copy-paste) | P1 | 1 sem |
| ANF-7.6 | Story | Tradução bidirecional em linha | P2 | 1 sem |
| ANF-7.7 | Story | Respostas rápidas e modelos | P2 | 3 d |

---

### ÉPICO ANF-8 — Operações e Equipas `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-8.1 | Story | Entidade Tarefa (tipo, alojamento, reserva, responsável, prazo, estado, fotos) | P1 | 1 sem |
| ANF-8.2 | Story | Geração automática de limpeza no checkout | P1 | 3 d |
| ANF-8.3 | Story | RBAC via Clerk Organizations (dono, gestor, limpeza, manutenção, proprietário) | P1 | 3 sem |
| ANF-8.4 | Story | PWA para equipa de limpeza (lista do dia, checklist, fotos, concluir) | P1 | 2 sem |
| ANF-8.5 | Story | Calendário de limpezas com deteção de conflitos (checkout+checkin no mesmo dia) | P1 | 1 sem |
| ANF-8.6 | Story | Manutenção: incidentes, fornecedores, custos | P2 | 2 sem |
| ANF-8.7 | Story | Inventário e reposição de consumíveis | P3 | 2 sem |
| ANF-8.8 | Story | Owner portal + repartição de receitas | P2 | 4 sem |

---

### ÉPICO ANF-9 — Experiência do Hóspede `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-9.1 | Story | Guest App (PWA por reserva) | P1 | 4 sem |
| ANF-9.2 | Story | Check-in: validação MRZ com checksum + deteção de documento expirado | P1 | 2 sem |
| ANF-9.3 | Story | Assinatura digital do contrato com selo temporal e IP | P1 | 2 sem |
| ANF-9.4 | Story | Verificação de vivacidade (selfie ↔ documento) com consentimento explícito | P2 | 2 sem |
| ANF-9.5 | Story | Guidebook digital gerado por IA | P1 | 2 sem |
| ANF-9.6 | Story | Upsells (early check-in, late checkout, transfer, limpeza extra) | P1 | 3 sem |
| ANF-9.7 | Story | Cofre de códigos com envio programado | P2 | 1 sem |
| ANF-9.8 | Story | Fechaduras inteligentes (Nuki, TTLock, igloohome) | P2 | 3 sem |

---

### ÉPICO ANF-10 — Canais e Distribuição `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-10.1 | Story | Fila de sincronização iCal com retry, backoff e estado por feed | P1 | 2 sem |
| ANF-10.2 | Story | Deteção e alerta de dupla reserva | P1 | 1 sem |
| ANF-10.3 | Story | `ChannelAdapter` (abstração de canal) | P1 | 2 sem |
| ANF-10.4 | Story | Booking.com Connectivity API | P1 | 3–6 meses |
| ANF-10.5 | Story | Airbnb API oficial | P2 | 6–12 meses |
| ANF-10.6 | Story | Sites de tenant: domínio próprio + indexação | P1 | 1 sem |
| ANF-10.7 | Story | MB WAY + Multibanco | P1 | 2 sem |
| ANF-10.8 | Story | Widget de reservas embebível | P2 | 2 sem |
| ANF-10.9 | Story | Migração em 1 clique (Smoobu/Lodgify/CSV) | P1 | 3 sem |

---

### ÉPICO ANF-11 — IA `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-11.1 | Story | Governação: limites de custo por conta, kill switch, auditoria | P0 | 1 sem |
| ANF-11.2 | Story | Auto-resposta com contexto + aprovação num toque | P1 | 4 sem |
| ANF-11.3 | Story | Auditor de conformidade por IA | P1 | 3 sem |
| ANF-11.4 | Story | Redator de anúncios multilingue | P1 | 1 sem |
| ANF-11.5 | Story | Resposta a avaliações (3 níveis de tom) | P1 | 1 sem |
| ANF-11.6 | Story | Explicação de números em linguagem natural | P2 | 2 sem |
| ANF-11.7 | Story | Analisador de avaliações → 3 ações concretas | P2 | 2 sem |
| ANF-11.8 | Story | Deteção de hóspede de risco | P2 | 3 sem |
| ANF-11.9 | Story | Onboarding conversacional | P2 | 2 sem |
| ANF-11.10 | Story | Categorização de despesas por foto de recibo | P3 | 2 sem |
| ANF-11.11 | Story | Agente de compliance autónomo | P2 | 8 sem |

---

### ÉPICO ANF-12 — Design e UX `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-12.1 | Story | Navegação de 13 → 6 destinos | P1 | 4 d |
| ANF-12.2 | Story | "Hoje" redesenhado, orientado a ações | P1 | 3 sem |
| ANF-12.3 | Story | Sistema de design: escala de terracota, cores semânticas, tabular nums | P1 | 2 sem |
| ANF-12.4 | Story | Par tipográfico com carácter (display + UI) | P1 | 1 sem |
| ANF-12.5 | Story | Dark mode com decisão de design própria | P1 | 1 sem |
| ANF-12.6 | Story | Motion nativo (View Transitions, scroll-driven, contadores) | P1 | 4 d |
| ANF-12.7 | Story | Command palette ⌘K completo | P1 | 3 d |
| ANF-12.8 | Story | Estados vazios com ação e dados de exemplo | P1 | 4 d |
| ANF-12.9 | Story | Skeletons + optimistic UI transversais | P1 | 1 sem |
| ANF-12.10 | Story | Checklist de onboarding com progresso persistente | P0 | 4 d |
| ANF-12.11 | Story | Auditoria WCAG 2.2 AA (axe-core já está instalado — usar) | P1 | 1 sem |
| ANF-12.12 | Story | Densidade configurável | P3 | 3 d |

---

### ÉPICO ANF-13 — Pricing e Monetização `P0`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-13.1 | Story | Plano Grátis permanente (1 alojamento, 5 reservas/mês) | P0 | 2 d |
| ANF-13.2 | Story | Trial de 30 dias | P0 | 2 h |
| ANF-13.3 | Story | Novos escalões + grandfathering dos clientes atuais | P0 | 3 d |
| ANF-13.4 | Story | Add-ons no Stripe (RM Pro, WhatsApp, domínio, alojamento extra, Pack Contabilista) | P1 | 1 sem |
| ANF-13.5 | Story | Upsells contextuais no limite de plano | P1 | 3 d |
| ANF-13.6 | Story | Fluxo de cancelamento com oferta de retenção (pausa sazonal) | P1 | 3 d |
| ANF-13.7 | Story | Programa de afiliados para contabilistas (20 % recorrente) | P1 | 2 sem |
| ANF-13.8 | Story | Referência entre anfitriões (1 mês grátis a cada lado) | P2 | 1 sem |
| ANF-13.9 | Story | Recuperação de pagamentos falhados (dunning) | P1 | 3 d |

---

### ÉPICO ANF-14 — SEO e Conteúdo `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-14.1 | Story | Motor de blog institucional em `anfitrioes.pt` | P1 | 1 sem |
| ANF-14.2 | Story | 8 guias do cluster de conformidade | P1 | 2 sem |
| ANF-14.3 | Story | ~40 páginas de taxa turística por concelho | P1 | 2 sem |
| ANF-14.4 | Story | 6 páginas `/vs/[concorrente]` | P1 | 4 d |
| ANF-14.5 | Story | Programmatic SEO `/rendimento/[cidade]/[tipologia]` | P1 | 4 sem |
| ANF-14.6 | Story | Schema Article/FAQ/Breadcrumb em todo o conteúdo | P1 | 3 d |
| ANF-14.7 | Story | Reativar indexação dos sites `/r/[slug]` | P1 | 4 h |
| ANF-14.8 | Story | `hreflang` para EN/ES | P2 | 2 d |
| ANF-14.9 | Story | Simulador público de rendimento (captura de leads) | P1 | 2 sem |

---

### ÉPICO ANF-15 — Performance e Engenharia `P1`
| ID | Tipo | Título | Pri | Est. |
|---|---|---|---|---|
| ANF-15.1 | Story | Playwright em CI contra preview + branch Supabase | P1 | 2 sem |
| ANF-15.2 | Story | Reparar auto-deploy GitHub→Vercel | P1 | 1 d |
| ANF-15.3 | Story | Refactor de `precos/page.tsx` (1474 L) | P1 | 2 sem |
| ANF-15.4 | Story | Server Components + `dynamic()` nas páginas pesadas | P1 | 1 sem |
| ANF-15.5 | Story | Índices compostos `(owner_id, data)` + vistas materializadas nos relatórios | P1 | 1 sem |
| ANF-15.6 | Story | Self-host de fontes com subsetting | P2 | 1 d |
| ANF-15.7 | Story | Orçamento de bundle no CI | P2 | 2 d |
| ANF-15.8 | Story | Cobertura de testes ≥60 % nas libs de dinheiro/datas/compliance | P1 | 2 sem |
| ANF-15.9 | Story | PITR + restauro testado trimestralmente | P1 | 3 d |
| ANF-15.10 | Story | Ambiente de staging | P1 | 3 d |

---

## Ordem de execução recomendada — primeiras 4 semanas

1. **Dia 1:** iniciar H1 (AIMA), H5 (orçamento), H6 (marca). Nenhum destes bloqueia código.
2. **Semana 1:** ANF-1.1→1.3 (copy), ANF-2.1→2.3 (observabilidade), ANF-1.6 (rate limit).
3. **Semana 2:** ANF-1.4 (RLS), ANF-13.1→13.3 (pricing), ANF-3.1 (headline).
4. **Semana 3:** ANF-4.1→4.3 (cofre de compliance — a primeira feature verdadeiramente única), ANF-3.2→3.4 (prova visual).
5. **Semana 4:** ANF-12.10 (onboarding), ANF-6.7 (relatório mensal), ANF-14.4 (páginas de comparação).

No fim da semana 4 o produto tem: risco legal e de segurança resolvido, visibilidade de dados, uma feature que nenhum concorrente tem, prova visual na landing e um modelo de preço que sustenta o resto do plano.

---

## Métricas de sucesso

| Métrica | Hoje | 3 meses | 12 meses |
|---|---|---|---|
| Conversão visita → registo | desconhecida | 4 % | 8 % |
| Ativação (1.ª reserva sincronizada em 24 h) | desconhecida | 55 % | 75 % |
| Trial → pago | desconhecida | 22 % | 35 % |
| Churn mensal | desconhecido | <5 % | <2,5 % |
| ARPU | ~€25 | €38 | €55 |
| Clientes pagantes | — | 40 | 400 |
| MRR | — | €1.500 | €22.000 |
| Tráfego orgânico | ~0 | 2.000/mês | 25.000/mês |
| NPS | — | 40 | 60 |

**"Porque iria escolher qualquer outra plataforma?"** — a resposta só existe se, no fim da Fase 2, um anfitrião português puder dizer: *"porque só o Anfitrião trata do SIBA, das faturas, da taxa turística e do INE sozinho — e cobra por conta, não por apartamento."* Tudo o resto neste documento serve essa frase.

---

### Fontes de mercado e regulação consultadas
- [Boletins de Alojamento: Guia Completo 2026 — Chekin](https://chekin.com/pt/blog/boletins-de-alojamento/)
- [AIMA Alojamento Local: O Que Mudou em 2026 — Chekin](https://chekin.com/pt/blog/siba-aima-alojamento-local/)
- [SIBA (SEF/AIMA): O Que É e Como Registar Hóspedes — EazyAL](https://www.eazyal.com/pt/blog/o-que-e-o-siba)
- [Alojamento Local Portugal 2026: Licence, SIBA & Legal Rules — EazyAL](https://www.eazyal.com/blog/portugal-local-accommodation-legal-guide-2026)
- [Taxa Turística por Cidade em Portugal 2026 — EazyAL](https://www.eazyal.com/blog/complete-guide-to-the-municipal-tourist-tax)
- [Registo de Alojamento Local em 2026 — Chekin](https://chekin.com/pt/blog/registo-alojamento-local/)
- [Alojamento Local e Impostos — Lodgify](https://www.lodgify.com/pt/guias/impostos-alojamento-local/)
- [Smoobu Pricing 2026 — Comparatif Channel Manager](https://comparatifchannelmanager.fr/en/smoobu-pricing/)
- [Lodgify vs Smoobu (2026) — HostRadar](https://hostradar.eu/en/comparisons/lodgify-smoobu-comparison/)
- [Beds24 vs Guesty vs Lodgify vs Hospitable vs Smoobu APIs — Bolder Technologies](https://www.boldertechnologies.net/beds24-vs-guesty-vs-lodgify-vs-hospitable-vs-smoobu-apis/)
