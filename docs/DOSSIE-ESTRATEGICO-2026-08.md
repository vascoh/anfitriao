# Anfitrião — Dossiê Estratégico (agosto 2026)

**Data:** 2026-08-02
**Âmbito:** auditoria técnica, arquitetura, segurança, performance, UX/UI, concorrência mundial, SWOT, oportunidades, inovação, roadmap, lançamento, internacionalização, plano comercial e de marketing.
**Base:** código em `~/projetos/anfitriao` (249 ficheiros TS/TSX, 31.678 linhas em `src`, 29 migrações), produção `https://anfitrioes.pt`, `PLANO-ESTRATEGICO-2026.md` (2026-07-27), `TODO.md`, `PROGRESS.md`, `docs/MES-DE-USO-REAL.md`, `docs/SINCRONIZACAO.md`, investigação de mercado e regulação feita hoje.

> Este documento **substitui a tese central** do `PLANO-ESTRATEGICO-2026.md`. O plano de julho continua válido como backlog de execução (épicos ANF-1 a ANF-15). O que mudou foi o diagnóstico competitivo — e mudou o suficiente para alterar decisões.

---

> ## ⚠️ Correção de 2026-08-17 — a tese de preço também caiu
>
> Este dossiê corrigiu, a 2 de agosto, a tese de julho ("a conformidade PT é um
> fosso vazio"). A tese que a substituiu — **"a vantagem que sobra é o preço por
> conta, e nenhum concorrente a pode copiar"** — é, ela própria, **falsa**.
>
> **O TalkGuest cobra por conta.** É português, tem 1000+ clientes de 1 a 250+
> unidades, e o plano de entrada custa **€13,50/mês** — menos de metade do
> Starter do Anfitrião. Faz **SIBA por web service** (o mesmo mecanismo que
> construímos), faturação certificada, TMT, channel manager por **API** (Airbnb,
> Booking, Vrbo, Expedia — calendários **e preços**), owner portal, tarefas,
> BI, apps iOS/Android e pricing dinâmico. O site de reservas próprio existe,
> mas só no plano Enterprise (€71,10).
>
> Verificado a 2026-08-17 em [talkguest.com/pricing](https://talkguest.com/pricing),
> [talkguest.pt/todas-as-funcionalidades](https://www.talkguest.pt/todas-as-funcionalidades)
> e na [ajuda deles sobre o modo Web Service do SIBA](https://talkguest.zendesk.com/hc/pt-pt/articles/360002657198-Como-alterar-o-m%C3%A9todo-de-envio-no-SIBA).
>
> **É a segunda vez que o fosso presumido aparece ocupado.** O padrão é o mesmo
> das duas vezes: olhou-se para o mercado internacional (Guesty, Hostaway,
> Lodgify, PriceLabs) e para os especialistas de conformidade (EazyAL, Hostkit),
> e não para o **PMS português com preço por conta** que já servia mil clientes.
> A lição operacional: antes de escrever "nenhum concorrente pode copiar isto",
> procurar quem já o faz — e escrever a data e a fonte ao lado.
>
> **O que isto invalida:** M1 ponto 3, a frase de posicionamento (§9.1), o
> racional de preços (§13.2) e a conclusão competitiva (§6.4).
>
> **O que isto não invalida:** o caminho de execução. A conformidade continua a
> ser bilhete de entrada, o SIBA por web service continua desbloqueado, e a
> estratégia de **camada, não substituição** (§9.2) fica **mais** válida, não
> menos — porque agora é claro que não somos alternativa a um PMS com channel
> manager por API.
>
> **Onde sobra vantagem defensável** (tudo já construído, ver `PROGRESS.md`):
> conformidade **com prova** (SHA-256 do XML enviado e resposta arquivada em
> `siba_submissoes` — todos vendem o envio, ninguém vende a evidência para uma
> fiscalização de 100 a 10.000 € por boletim), **boletim por pessoa** com recusa
> de submissão incompleta, **RGPD aplicado por código** (retenção diária,
> encriptação em repouso, registo de saída de dados), e **casa inteira modelada
> a sério** (N reservas ligadas, uma fatura, um email, disponibilidade atómica).
>
> **Onde estamos atrás, e convém dizê-lo:** sem channel manager por API (o iCal
> só transporta datas), sem owner portal, sem app móvel, sem tarefas de limpeza,
> sem pricing dinâmico, sem caixa de entrada — e com um cliente contra mil.

---

---

## 0. Sumário executivo — as três coisas que mudaram desde 27 de julho

### M1 — O fosso escolhido já está ocupado. Por dois portugueses.

O plano de julho assentava numa frase: *"o fosso competitivo real está em compliance fiscal portuguesa, e está vazio"*. **Isso é falso em agosto de 2026**, e provavelmente já era falso em julho — a análise olhou para Guesty/Hostaway/Lodgify (que de facto nunca farão isto) e não para o mercado local.

| Concorrente | O que já faz hoje | Preço |
|---|---|---|
| **EazyAL** (Madeira) | **Submissão automática SIBA**, INE IPHH/WebInq, cálculo de taxa turística municipal com isenções, faturação certificada via Vendus, check-in digital com leitura de passaporte, despesas, calendário para limpezas | **desde €10/alojamento/mês** (anual). Plano *Complete* anunciado com ligação a Airbnb e Booking |
| **Hostkit** (Portugal) | Faturação automática à AT (faturas-recibo de reservas **e de comissões**), SIBA, taxas turísticas, INE, **Modelo 30**, fechaduras inteligentes, estatísticas — e integra-se por cima de Smoobu, Avantio, Hostaway, Little Hotelier, BOOM | por alojamento, modular, sem fidelização, 30 dias grátis |
| **Chekin** | Check-in + compliance multi-país (PT, ES, IT, FR, GR), integração certificada SIBA | por reserva / assinatura |

Consequências diretas:

1. **A headline de conformidade recomendada em julho já não diferencia.** "SIBA, faturas e taxa turística tratados sozinhos" é literalmente o que a EazyAL e a Hostkit vendem — e elas *entregam*, enquanto o Anfitrião devolve 501.
2. **A conformidade passou de fosso a bilhete de entrada.** É obrigatória para competir e insuficiente para ganhar. Continua a ser prioridade máxima de execução — mas como *paridade*, não como *posicionamento*.
3. ~~**A vantagem estrutural que sobra é o preço por conta.**~~ **Corrigido a 2026-08-17: falso.** EazyAL, Hostkit, Lodgify, Uplisting e PriceLabs cobram por alojamento — mas o **TalkGuest cobra por conta, desde €13,50/mês, e é português**. O preço por conta continua a ser melhor do que o preço por unidade; deixa de ser um diferenciador, porque há quem o faça mais barato e com mais funcionalidades. Ver a correção no topo deste documento.

### M2 — O SIBA automático **está desbloqueado**. A dependência humana H1 era falsa.

O plano de julho classificou "credenciais junto da AIMA" como a única dependência humana verdadeiramente crítica, com *lead time* longo e caminho B de contingência (automação assistida do portal). **Não é preciso nada disso.** O SIBA tem um web service público e documentado, e as credenciais são do *anfitrião*, não da plataforma:

- **Endpoint de produção:** `https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx` (WSDL em `?WSDL`). Legado ainda documentado: `https://siba.sef.pt/baws/…`; ambiente de testes `…/bawsdev/…`.
- **Método:** `EntregaBoletinsAlojamento`, SOAP.
- **Parâmetros:** `UnidadeHoteleira` (NIPC, 9 dígitos) · `Estabelecimento` (número atribuído pelo SEF/AIMA no registo; a primeira unidade de um NIPC recebe `00`) · `ChaveAcesso` (chave de ativação, só dígitos) · `Boletins` (XML conforme `BAL.XSD`, em Base64).
- **Como se obtêm as credenciais:** o anfitrião regista a unidade na área reservada do portal SIBA e escolhe o modo de envio **Web Service**. Recebe o número de estabelecimento e a chave por email em **1 a 3 dias úteis**. As credenciais emitidas pelo SEF continuam válidas com a AIMA, sem novo registo.
- Existe biblioteca open-source de referência para o formato (`rafaelrpinto/node-siba`).

**Isto reclassifica ANF-4.9 de "bloqueado por terceiros / 3 semanas + humano" para "2 a 3 semanas de engenharia, sem dependência externa".** É a correção mais valiosa deste dossiê. O trabalho real passa a ser: cofre encriptado de credenciais por alojamento, gerador de XML `BAL.XSD`, cliente SOAP com *retry* e *backoff* (o serviço devolve páginas HTML de erro em vez de SOAP quando está em baixo — 503 é comum), máquina de estados por boletim, e **prova de submissão arquivada**.

### M3 — A landing v2 regrediu naquilo que julho tinha corrigido.

A landing em produção (`anfitrioes.pt`, componentes em `src/components/landing-v2/`) reintroduziu exatamente os problemas que o épico ANF-1 tinha fechado, e trocou a identidade da marca:

| Problema | Evidência | Gravidade |
|---|---|---|
| **Promete uma caixa de entrada unificada que não existe** | `features.tsx`: *"Mensagens centralizadas — Todas as conversas numa única caixa de entrada"*; `dashboard-preview.tsx` mostra uma bandeja com mensagens de Airbnb/Booking/Direto | 🔴 Publicidade enganosa. O produto tem um Concierge que gera texto para copiar e colar. Não lê nem envia mensagens de lado nenhum |
| **Promete contrato eletrónico** | `features.tsx`: *"Check-in digital, contrato eletrónico e fotografias"* | 🔴 Não existe (ANF-9.3 por fazer) |
| **"Sincroniza Airbnb, Booking e Vrbo, com atualização contínua"** | iCal, cron **1×/dia às 04:00** (limite do plano Hobby da Vercel) | 🔴 "Contínua" é o oposto de 1×/dia. Reabre o risco de dupla reserva mal descrito |
| **Métrica "+12% ocupação" no visual** | `dashboard-preview.tsx` | 🟠 Sem base real. Diretiva Omnibus |
| **Cisma de marca** | Landing: `Inter`, fundo escuro, acento **ciano** · App: `Geist`, off-white quente, acento **terracota** | 🟠 A landing usa duas das anti-referências declaradas em `PRODUCT.md` ("inter on white", "crypto/fintech neon-on-dark"). Quem vem do site entra noutro produto |
| **Ângulo de conformidade abandonado** | Headline: *"Centraliza tudo. Hospeda melhor."* | 🟠 Genérica. Qualquer um dos 25 concorrentes a pode usar |

O mérito da landing v2: os testemunhos foram corretamente esvaziados com nota explícita sobre a Diretiva Omnibus, a garantia de 30 dias entrou na FAQ, as páginas `/vs/[slug]` existem e a acessibilidade foi levada a zero violações WCAG AA. O problema é ter deixado a copy do produto correr à frente do produto outra vez.

### Diagnóstico em duas frases

O Anfitrião é hoje **o produto mais completo do seu segmento em Portugal que ninguém usa** — 6 secções de app coerentes, motor de taxa turística, cofre de conformidade, faturação com adaptador certificado, RGPD aplicado por código, 345 testes verdes. E tem **zero clientes pagantes, zero observabilidade, zero prova social, e três promessas por cumprir na página inicial**.

O risco número um deixou de ser técnico. É de **posicionamento**: construir mais durante meses enquanto a EazyAL e a Hostkit fecham o mercado que ele quer.

---

# PARTE I — AUDITORIAS

## 1. Auditoria técnica

### 1.1 Estado verificado (executado hoje)

```
npm test  →  22 ficheiros, 345 testes, 100% verdes, 1,42 s
```

Cobertura concentrada onde importa (dinheiro, datas, conformidade): `utils`, `reservations`, `ical`, `ical-fetch`, `ical-guias`, `siba`, `compliance`, `taxa-turistica`, `faturacao`, `iva`, `ine`, `retencao`, `noites-orfas`, `relatorio-mensal`, `rate-limit`, `push`, `email`, `onboarding`, `labels`, `api/book`, contraste da landing. **Esta é a parte mais saudável do projeto** e deve ser defendida: a regra implícita "lógica pura em `lib/`, testada; páginas só apresentam" está a ser cumprida.

### 1.2 Dívida técnica — por ordem de custo real

| # | Achado | Evidência | Impacto | Esforço | Ação |
|---|---|---|---|---|---|
| T1 | **A app é um SPA client-side dentro do App Router** | 59 de 114 componentes com `'use client'`; **todas** as páginas de `(app)/` são client e buscam dados por `fetch` a rotas de API | LCP e TTI degradados, cascatas de pedidos, bundle grande, `service_role` a servir dados que podiam ser resolvidos no servidor | Alto | Converter, por página, para Server Components com `dynamic()` nas tabelas. Começar por `/hoje`, `/relatorios`, `/calendario` |
| T2 | `precos/page.tsx` — **1474 linhas**, inalterado desde julho | maior ficheiro do projeto, 3× o segundo | Impossível de testar, impossível de tornar mobile, fonte previsível de bugs de preço | Médio | Partir em `regras/`, `tarifas/`, `plataformas/` com estado por separador |
| T3 | `hoje/page.tsx` carrega **todos** os bookings históricos | conhecido (B3 no `HANDOFF.md`), 610 linhas | Degrada linearmente com o uso. Com 3 anos de reservas, a página principal é a mais lenta | Baixo | Endpoint agregado `/api/hoje` com as 4 contagens em SQL |
| T4 | **Duas navegações paralelas** (`side-nav` + `bottom-nav`) | resolvidas por `lib/navigation.ts` (bom) | Baixo — a fonte única já foi feita. Só sobra manter | — | Manter a regra dos 6 destinos |
| T5 | ID de modelo de IA com sufixo de data | `concierge/route.ts`: `claude-haiku-4-5-20251001` | Nenhum hoje; o ID canónico é `claude-haiku-4-5` | Trivial | Trocar. O OCR em `claude-sonnet-4-6` está correto e atual |
| T6 | Sem *staging*, sem E2E em CI | testes E2E são feitos **em produção** com prefixo `TESTE-E2E` | Risco de poluir dados reais assim que houver clientes | Médio | Playwright em CI contra *preview* + branch Supabase |
| T7 | Auto-deploy GitHub→Vercel partido | `CLAUDE.md` | Deploy manual não escala e convida a saltar o `npm test` | Baixo | Reparar, e pôr `npm test && npm run typecheck` como *gate* |
| T8 | 15 ficheiros `CHANGELOG_PHASE_XX.md` na raiz | raiz do repositório | Ruído; a raiz é o primeiro sítio onde alguém olha | Trivial | `docs/changelog/` |

### 1.3 Base de dados

29 migrações, aplicadas e coerentes. **Índices existem e estão bem escolhidos** (36 `CREATE INDEX`, incluindo parciais: `posts_publicado_idx WHERE publicado`, `automations_trigger_ativo_idx WHERE ativo`, `bookings_siba_status_idx`). Isto está acima da média para um projeto desta idade.

| # | Achado | Gravidade | Ação |
|---|---|---|---|
| D1 | **`owner_id` continua `TEXT` nullable em todas as tabelas** | 🟠 | Preencher os órfãos e aplicar `NOT NULL` + `DEFAULT` proibido. Enquanto for nullable, um `INSERT` esquecido cria dados invisíveis e o `canUpsertRow` trata `owner_id IS NULL` como reclamável — o que é correto hoje e passa a ser um vetor no dia em que houver muitos tenants |
| D2 | **Faltam índices compostos `(owner_id, data)`** | 🟠 | `bookings(owner_id, check_in)`, `bookings(owner_id, estado)`, `expenses(owner_id, data)`. Os índices atuais são de coluna única — o planeador vai preferir o filtro de `owner_id` e varrer o resto |
| D3 | Sem vistas materializadas nem agregações em SQL | 🟡 | `/relatorios` e `/financeiro` agregam em JS depois de trazer as linhas todas. Passar para SQL antes dos 10.000 registos |
| D4 | Sem PITR verificado nem restauro testado | 🟠 | Supabase PITR + um restauro de ensaio trimestral. Há dados de passaporte aqui |
| D5 | RLS ativo mas **sem políticas por JWT** | 🟠 | Ver §3 |

## 2. Auditoria de arquitetura

### 2.1 O que está bem, e deve ser protegido

- **Separação `lib/` puro vs. rotas.** É a razão pela qual há 345 testes rápidos.
- **Adaptadores.** `InvoicingAdapter` (InvoiceXpress implementado, Vendus/Moloni previstos), `lib/siba-api.ts` como contrato, `lib/email/providers/`. O padrão certo, já instalado.
- **Fonte única de navegação** (`lib/navigation.ts`) alimentando side-nav, bottom-nav e ⌘K.
- **Fonte única de rotas públicas** (`src/proxy.ts`), privado por omissão.
- **Anti-SSRF por allowlist** no fetch de iCal.
- **UID não reversível no feed iCal público** — o `id` real da reserva daria acesso ao check-in com PII. Detalhe de segurança que muita gente não vê.
- **`canUpsertRow`** contra IDOR em upserts com admin client.

### 2.2 A decisão arquitetural que precisa de ser tomada

O produto vive hoje entre dois modelos e paga o custo dos dois:

```
Browser ──fetch──► /api/* ──service_role──► Supabase (RLS bypassado, filtro .eq('owner_id') à mão)
```

Isto significa: (a) o browser não fala com a base de dados, logo o RLS por JWT nunca é exercido; (b) todas as páginas são client components para poderem fazer `fetch`; (c) o isolamento entre inquilinos depende de **~20 filtros escritos à mão**, auditados uma vez.

Três caminhos, e é preciso escolher um:

| Caminho | O que implica | Recomendação |
|---|---|---|
| **A — Server Components + service_role no servidor** | Páginas passam a `async` server components, buscam com o admin client e o `userId` de `auth()`, sem rota de API pelo meio. Mantém o modelo de isolamento atual, elimina metade das rotas e o waterfall | ⭐ **Escolher este.** É o menor delta, ganha performance imediata e mantém uma só forma de isolar |
| **B — RLS por JWT do Clerk** | Ligar o template JWT, políticas por `requesting_owner_id()`, browser fala direto com o Supabase | Fazer **como defesa em profundidade** depois de A, não em vez de A. E só **depois** de migrar o Clerk para instância de produção (o template tem de ser refeito) |
| **C — Manter como está** | — | Não. O custo de performance é permanente e o risco de uma linha esquecida nunca desce |

## 3. Auditoria de segurança

Auditei rotas, middleware, ownership, rate limiting e tratamento de PII.

### 3.1 Riscos por gravidade

| # | Risco | Estado | Gravidade | Ação |
|---|---|---|---|---|
| S1 | **Clerk em instância de desenvolvimento em produção** — chave `pk_test_…`, domínio `settled-weasel-80.clerk.accounts.dev` | Aberto | 🔴 **Bloqueia o segundo utilizador** | Migrar para instância de produção **antes** de qualquer RLS ou convite externo. Limites de utilizadores, credenciais OAuth partilhadas, ecrã de consentimento Google a mostrar `clerk.accounts.dev` |
| S2 | **Rate limit em memória num runtime serverless** | Aberto desde julho | 🔴 | `lib/rate-limit.ts` guarda estado num `Map` de processo. Na Vercel, cada invocação pode ser instância nova → o limite das rotas públicas (`/api/book`, `/api/checkin`, `/api/documentos/extrair`, `/api/concierge`) é **efetivamente inexistente**. Custo de IA e spam abertos. Upstash Redis, 1 dia |
| S3 | **Dados de documento de identificação em claro** | Aberto | 🔴 | Número de passaporte/CC, nacionalidade, data de nascimento em `guests`, sem encriptação de coluna nem log de acesso. Com RGPD art. 9.º e coimas até 20 M€, é o pior risco residual. `pgsodium`/`pgcrypto` + `audit_log` de leitura |
| S4 | Isolamento só por código de aplicação | Mitigado, não resolvido | 🟠 | Ver §2.2. Auditado a 100% em julho; o risco é a **próxima** rota, não as atuais |
| S5 | **Sem monitorização de erros** | Aberto | 🟠 | Zero Sentry, zero PostHog, zero Vercel Analytics — confirmado por varrimento de dependências. Um erro em produção só é conhecido se o próprio utilizador o encontrar |
| S6 | Sem MFA | Aberto | 🟡 | Ativar no painel do Clerk. Configuração, não código |
| S7 | Testes E2E em produção | Aberto | 🟠 | Ver T6 |
| S8 | Sem PITR verificado | Aberto | 🟠 | Ver D4 |
| S9 | Retenção do `audit_log` e dos dados de conta após cancelamento indefinida | Aberto | 🟡 | É a única lacuna do registo de tratamentos. Decisão humana, ver §16 |

### 3.2 O que está correto e merece registo

- Crons protegidos por `CRON_SECRET` com **falha fechada em produção** (503 se o segredo não estiver definido) — implementação correta em `lib/cron-auth.ts`.
- Webhook Stripe verificado por assinatura, fulfillment idempotente, reembolso automático em conflito de datas.
- `/api/concierge` exige `auth()` e limita a 20 pedidos/minuto **por utilizador** (não por IP) — a chave certa; falha só por causa de S2.
- Entradas do Concierge com *clamp* de tamanho (4000 caracteres) antes de ir ao modelo.
- Anti *formula injection* na geração de CSV do SIBA.
- Retenção RGPD aplicada por cron às 03:00, com **anonimização em vez de apagamento** — correto, porque o art. 52.º do CIVA obriga a conservar a reserva 10 anos. Poucos concorrentes acertam nisto.

## 4. Auditoria de performance

| Área | Estado | Ação |
|---|---|---|
| **Renderização** | 🔴 SPA client-side (T1). Todas as páginas de app são `'use client'` | Server Components — o maior ganho isolado disponível |
| **Cascatas de dados** | 🔴 Cada página faz N `fetch` sequenciais depois do *hydrate* | Resolver no servidor; onde não der, `Promise.all` |
| **Bundle** | 🟠 `motion`, `lenis`, `lucide-react`, `sonner` + a landing inteira em client | A landing pode ser quase toda estática; `motion` só onde é preciso |
| **Fontes** | 🟠 Geist + Geist Mono (app) + Inter (landing) = **3 famílias** | Consolidar em 2 e auto-alojar com *subset* latin |
| **Imagens** | ✅ `next/image` + Vercel Blob, `remotePatterns` e CSP corrigidos | Garantir AVIF/WebP e `sizes` |
| **Cache** | 🟠 Só `revalidate = 300` no feed iCal | `revalidate` nas páginas públicas de tenant, `unstable_cache` nos relatórios |
| **Sincronização iCal** | 🟠 Síncrona no pedido, sem fila nem retry; automática **1×/dia** | Fila (QStash/Inngest) + estado por feed. O 1×/dia é limite do plano Hobby — decisão de orçamento |
| **Observabilidade** | 🔴 **Inexistente** | Sem isto, nada nesta secção é mensurável. É o primeiro passo, não o último |

## 5. Auditoria UX/UI

### 5.1 O que melhorou desde julho (verificado no código)

- **13 → 6 destinos** de topo, com sub-navegação contextual e regra escrita no próprio ficheiro. Feito e bem feito.
- ⌘K alimentado pela mesma fonte de navegação.
- Alertas de sincronização em `/hoje` (calendário sem sincronizar há +48 h).
- Instruções por plataforma dentro do formulário de iCal, com deteção de duplicação de feeds (`deveAvisarDuplicacao`) — resolve o passo mais frágil do onboarding.
- Contraste corrigido: `--primary` de 59% para 52% de luminosidade para passar AA.

### 5.2 O que continua por resolver

| # | Problema | Impacto |
|---|---|---|
| U1 | **`/precos` com 1474 linhas expõe 3 conceitos concorrentes** (regras, tarifas, taxas de plataforma) | Viola diretamente o princípio "se demora mais de 2 toques está errado". É a página que mais afasta o utilizador-alvo |
| U2 | **Não existe entidade "tarefa"** | Todo o trabalho operacional — limpeza, manutenção — vive fora da app. É a lacuna mais citada por hosts em qualquer estudo do setor, e o próprio `MES-DE-USO-REAL.md` antecipa-a: *"quis marcar limpeza feita e não existe"* |
| U3 | **Dark mode sem decisão de design** | A identidade é "sol numa parede portuguesa". Em dark mode desaparece e fica shadcn genérico |
| U4 | **Estados vazios sem ação** | Conta nova cai num dashboard vazio |
| U5 | **Sem gestos, sem pull-to-refresh, sem haptics** | É PWA mas não *sente* como app. `PRODUCT.md` diz "mobile canónico" |
| U6 | **Tipografia sem contraste** | Headings e corpo na mesma família e escala. Números sem `tabular-nums` garantido nas tabelas financeiras |
| U7 | **Sem upsell contextual no limite de plano** | Quem tenta criar a 4.ª propriedade no Starter vê um erro, não uma oferta |

---

# PARTE II — MERCADO

## 6. Concorrência — varrimento completo

### 6.1 Camada A — Conformidade portuguesa e ibérica (**os concorrentes reais**)

| Concorrente | Modelo | Força | Fraqueza | O que fazer |
|---|---|---|---|---|
| **EazyAL** | €10+/alojamento/mês | SIBA automático, INE WebInq, TMT com isenções, faturação Vendus, feito por um host da Madeira (credibilidade), **SEO dominante** em PT/EN | Não é PMS (a conectividade é "coming soon"), preço por alojamento explode com portfólio, sem revenue management | Atingir paridade de conformidade e bater no preço por conta. Não competir em SEO de raiz — competir em **profundidade** (ver §8) |
| **Hostkit** | por alojamento, modular | Faturação à AT incluindo **comissões**, Modelo 30, fechaduras, e **integra-se por cima de qualquer channel manager** | UI datada, modular = carrinho de compras, sem produto de operação diária | Copiar o *modelo de distribuição* (camada por cima do que já usas), não o produto |
| **Chekin** | por reserva | Multi-país (PT/ES/IT/FR/GR), integração certificada SIBA, conteúdo massivo | Nicho de check-in, caro por volume | Referência para a expansão europeia |
| **TalkGuest** (Porto) | **€13,50–71,10/mês, por conta** (6 ou 12 meses) | **PMS português completo e por conta**: SIBA por web service, faturação certificada, TMT, channel manager por API (Airbnb, Booking, Vrbo, Expedia — calendários e preços), owner portal, tarefas/staff, BI, apps iOS/Android, pricing dinâmico. **1000+ clientes**, de 1 a 250+ unidades | Site de reservas próprio só no Enterprise (€71,10). Não comunica conformidade como argumento central — a página de preços nem menciona SIBA | **É o concorrente direto, não a EazyAL.** Não competir em amplitude nem em preço: competir em **profundidade de conformidade com prova** e no modelo de camada (§9.2) |
| **GuestGrow / SIBAGO / vezpa** | nicho | SEO de cauda longa em SIBA | Ferramentas de um só truque | Ignorar |

### 6.2 Camada B — PMS e channel managers (o campo onde o Anfitrião *parece* competir)

| Concorrente | Preço 2026 | Força | Fraqueza para PT |
|---|---|---|---|
| **Guesty** | enterprise, ~$100+/unidade | APIs nativas a todas as OTAs, owner portal, trust accounting | Caro, complexo, zero conformidade PT |
| **Hostaway** | ~$50–100+/mês + setup fee | Channel manager por API real, marketplace | Contrato anual, onboarding pesado |
| **Lodgify** | desde $20/listing (mín. ~$100/5) + 1,9 % | Website builder maduro, domínio próprio, SEO | Preço por listing + comissão |
| **Smoobu** | €26,10/mês +0,9 % ou €31,50 flat | Muito completo, forte na DACH | PT é secundário, interface densa |
| **Hospitable** | $0 → ~$29+/mês | **A melhor automação de mensagens do mercado**, auto-resposta dentro do Airbnb | Sem RM, sem site, sem conformidade EU |
| **Uplisting** | desde $20/listing (mín. $100) | Fiabilidade anti-double-booking | Caro para portfólios pequenos |
| **OwnerRez** | ~$40+/mês | Faturação, contratos, seguro (EUA) | 100 % EUA, UI datada |
| **Hostfully** | ~$100+/mês | Guidebooks digitais excelentes | Caro, fragmentado |
| **Beds24** | barato, pay-as-you-go | Extremamente flexível, API aberta | Curva de aprendizagem brutal |
| **Cloudbeds / Little Hotelier / Avantio / Octorate / Rentlio** | hotelaria e gestão profissional | Distribuição e PMS maduros | Overkill para 1–10 unidades; Little Hotelier e Avantio **já integram com a Hostkit** para PT |
| **Amenitiz** | ~€100+/mês | Força de vendas em PT/ES; **é o que o próprio fundador usa** | Anti-referência declarada de produto; caro |
| **Airbnb / Booking / VRBO** | comissão 3–20 % | A procura | Não são concorrentes: são o canal a domesticar |

### 6.3 Camada C — Especialistas verticais (o que o Anfitrião ainda não tem)

| Categoria | Líderes | Preço 2026 | Leitura |
|---|---|---|---|
| **Revenue management** | **PriceLabs** ($19,99/propriedade/mês; $14,49 multi-unidade EUA; alternativa a 1 % da receita) · **Wheelhouse** (1 % com mínimo $2,99, ou $19,99 flat) · **Beyond** (1–1,25 % da receita, **sem opção flat**) | $20/unidade ou 1 % | Um host com 4 unidades a €5.000/mês paga €50–62/mês só de pricing. **Incluir RM básico no plano do Anfitrião é uma proposta de valor imediata e quantificável** |
| **Limpezas e operação** | **Turno** (marketplace + agendamento) · **Operto** (acesso e operação) | por unidade | Nada disto existe em PT com equipas locais. Lacuna real |
| **Ruído e ocupação** | **Minut** (€10–15/mês, ruído + ocupação + fumo + clima) · **NoiseAware** ($15/mês + sensor $99) | hardware + subscrição | Integração, não construção. Vale como *add-on* |
| **Mensagens com IA** | **GuestGuru** (agora parte da Zeevou; primeiro anúncio a $1, auto-resposta, escalonamento, modo SMS) · Hospitable | baixo | Confirma que a auto-resposta com IA já é *commodity*. O Concierge do Anfitrião, que só gera texto para copiar, está **atrás do mercado**, não à frente |

### 6.4 Conclusão competitiva

Um anfitrião português com 4 unidades que queira o *stack* completo paga hoje:

```
Smoobu/Amenitiz (PMS)        €30–100
EazyAL ou Hostkit (PT)       €40
PriceLabs (RM)               €80
Turno (limpezas)             €0–40
                             ─────────
                             €150–260/mês
```

~~**O Anfitrião pode oferecer 80 % disto por €59/mês, por conta.**~~

**Corrigido a 2026-08-17.** A conta acima é verdadeira para quem monta o *stack* com ferramentas internacionais — mas não é o que um anfitrião português informado faz hoje. O **TalkGuest** entrega PMS + channel manager por API + SIBA + faturação certificada + owner portal **por conta, desde €13,50/mês**. A proposta "tudo isto cabe aqui e não pagas por apartamento" **já existe, mais barata**.

O que sobra, e é verdadeiro: **ninguém vende conformidade com prova.** Todos comunicam ao SIBA; nenhum arquiva o que foi enviado e o que o Estado respondeu, nem se recusa a submeter uma reserva incompleta dizendo quantas fichas faltam. Com coimas de 100 a 10.000 € **por boletim**, é a diferença entre uma funcionalidade e um seguro — e é a única frase deste dossiê que resiste a uma verificação de mercado.

## 7. Regulação — a janela de 2026

| Facto | Data | Implicação de produto |
|---|---|---|
| **Regulamento (UE) 2024/1028** — recolha e partilha de dados de alojamento de curta duração | **Aplicável desde 20 de maio de 2026** | Registo único obrigatório por Estado-Membro, **número de registo visível em todos os anúncios**, plataformas obrigadas a partilhar dados mensais de atividade com as autoridades e a verificar os números. Não impõe limites de noites nem licenciamento — isso continua local |
| **DL 76/2024** (em vigor desde 1 nov 2024) reverteu grande parte da Lei 56/2023 | vigente | Registo **deixou de caducar** aos 5 anos; caducidade por inatividade revogada; registo voltou a ser **transmissível** (exceto em áreas de contenção); oposição do condomínio passou a exigir fundamentação, maioria da permilagem e perturbações comprovadas |
| **IRS Categoria B, coeficiente 0,35** | vigente | O mapa fiscal continua a valer (ANF-4.14) |
| **Taxa turística** | por concelho | Lisboa €4/noite desde set/2024, mantida em 2026; Algarve desde €1,50; regra geral limitada às primeiras 7 noites, com isenções por idade |
| **SIBA/AIMA** | vigente | Coima de **100–1.500 €** (singular) e **500–10.000 €** (coletiva) **por cada boletim em falta** |

**Duas leituras acionáveis:**

1. **O 2024/1028 é o argumento comercial do segundo semestre de 2026.** Toda a Europa passou a precisar do que o Anfitrião faz. É a justificação natural para o cofre de conformidade e, mais tarde, para ES/IT.
2. **O DL 76/2024 tornou as licenças transmissíveis e perpétuas** — o que aumenta o valor de um AL como ativo e cria uma feature nova que ninguém tem: **dossiê de transmissão** (tudo o que um comprador precisa: RNAL, seguro, histórico de ocupação, receita, conformidade). Ver §9, I7.

---

# PARTE III — ESTRATÉGIA

## 8. Matriz SWOT

### Forças
1. **Preço por conta** contra um mercado inteiro que cobra por alojamento — a única vantagem estrutural não copiável.
2. Amplitude real: 6 secções coerentes, reservas diretas com Stripe Connect, sites por tenant, blog, faturação com adaptador, taxa turística, INE, cofre de conformidade, RGPD por código.
3. **Qualidade de engenharia acima da média**: 345 testes verdes, lógica pura isolada, adaptadores, anti-SSRF, anti-IDOR, anti-formula-injection.
4. Português nativo, AO90, sem brasileirismos — barreira pequena mas real para produtos internacionais.
5. Fundador é utilizador. O mês de uso real (agosto) vale mais do que qualquer *user research* comprada.
6. Velocidade de execução comprovada: 15 fases documentadas em ~5 semanas.

### Fraquezas
1. **Zero clientes, zero receita, zero prova social, zero observabilidade.** Nada é mensurável.
2. **Três promessas por cumprir na página inicial** (caixa de entrada, contrato eletrónico, sincronização contínua).
3. Clerk em instância de desenvolvimento — **impede tecnicamente o segundo utilizador**.
4. Rate limit inoperante em serverless; documentos de identificação em claro.
5. Sem conectividade real a OTAs. iCal 1×/dia.
6. Sem revenue management, sem tarefas/limpezas, sem caixa de entrada.
7. Cisma de marca entre landing e app.
8. Um só programador; nenhum canal de aquisição a funcionar.

### Oportunidades
1. **Regulamento (UE) 2024/1028** desde 20/05/2026 — vento de cauda regulatório em toda a Europa.
2. **SIBA web service desbloqueado** — paridade de conformidade alcançável em semanas.
3. Concorrentes de RM a $20/unidade — **incluir RM básico destrói a economia deles** no segmento SMB.
4. Segmento **guest house / multi-quarto** (o caso do próprio fundador): 3–8 quartos, mal servido pelos PMS (pensados por apartamento) e caríssimo em qualquer preço por unidade.
5. **Contabilistas como canal**: cada um serve 10–50 anfitriões. Melhor CAC do mercado.
6. **Camada por cima do channel manager existente** (modelo Hostkit) — remove a maior fricção de adoção: ninguém tem de largar o Amenitiz/Smoobu.
7. Espanha (SES.HOSPEDAJES) e Itália (Alloggiati Web) têm o mesmo problema e a mesma ausência de solução barata.

### Ameaças
1. **EazyAL e Hostkit fecham o mercado de conformidade PT em 12–18 meses.**
2. Airbnb e Booking a absorver funcionalidades (check-in, mensagens com IA, preço dinâmico) para dentro das próprias plataformas.
3. Um incidente de RGPD com dados de passaporte mata o produto no dia.
4. Dependência de um só programador.
5. Sazonalidade: falhar a época alta de 2026 empurra a validação comercial para 2027.
6. Consolidação (GuestGuru→Zeevou é o sinal): capital a comprar quota.

## 9. Posicionamento recomendado

### 9.1 A frase

~~**"Tudo o que o teu Alojamento Local precisa. Por conta, não por apartamento."**~~ — **substituída a 2026-08-17**: o TalkGuest cobra por conta desde €13,50, portanto a segunda metade da frase deixou de distinguir seja o que for.

> **"A tua conformidade, com prova."**
> *sub:* Boletins do SIBA entregues por pessoa, com o comprovativo do que foi enviado e do que o Estado respondeu. Faturas no teu NIF. Retenção de dados cumprida sozinha. Ligado ao que já usas — não substitui o teu channel manager.

Porquê esta: é a única afirmação que sobreviveu a duas verificações de mercado. A de julho descrevia o que a EazyAL e a Hostkit vendem; a de agosto descrevia o que o TalkGuest vende mais barato. Esta descreve o que **nenhum deles** vende — e que já está construído (`siba_submissoes`, `reserva_hospedes`, `lib/retencao.ts`, `lib/campos-sensiveis.ts`).

O preço por conta continua a ser uma vantagem sobre a EazyAL e a Hostkit; passa a ser um **argumento de segunda linha**, não a manchete.

### 9.2 A estratégia de entrada: **camada, não substituição**

O `SINCRONIZACAO.md` chegou sozinho à conclusão certa e não lhe deu o nome comercial: o **Modo Observador não é uma limitação, é o produto de entrada**.

```
O que já usas (Airbnb, Booking, Amenitiz, Smoobu)   →   continua a mandar
                          │ iCal
                          ▼
                    ANFITRIÃO   ←  onde vives o dia a dia:
                                   /hoje, check-in, SIBA, faturas,
                                   taxa turística, IRS, receita, IA
```

Isto resolve, de uma vez, os três maiores obstáculos comerciais: **não exige migração**, **não compete com o channel manager de quem já paga um**, e **não promete conectividade que não existe**. É o modelo pelo qual a Hostkit sobrevive há anos ao lado da Smoobu e da Avantio, e é o único caminho honesto enquanto não houver API.

A Fase B do `SINCRONIZACAO.md` (fila de "por aplicar" com deteção de divergência) é a evolução natural e **não existe em lado nenhum do mercado**. Construir.

### 9.3 Segmento inicial (ICP)

**Anfitrião português com 2 a 8 unidades ou quartos, que já tem channel manager ou vive no extranet, e cujo maior custo mensal invisível é a conformidade.**

Não perseguir: o dono de 1 T1 ocasional (não paga), nem a empresa de gestão com 50 unidades (precisa de RBAC, owner portal e API — ANF-8 por fazer).

## 10. Oportunidades e inovações — o que ninguém tem

Filtrado contra os 25 concorrentes estudados. Excluí tudo o que já existe em ≥2 deles.

| # | Ideia | Porque é defensável | Dific. | Prior. |
|---|---|---|---|---|
| **I1** | **Prova de conformidade, não só submissão.** Cada boletim SIBA, mapa de TMT e fatura gera um recibo arquivado com selo temporal e resposta original do serviço. Um botão "Dossiê ASAE" gera o PDF completo do alojamento | Todos vendem *submissão*. Ninguém vende a **prova** — que é o que interessa no dia da fiscalização. Custo marginal quase zero porque a resposta do web service já vem | 3 | 10 |
| **I2** | **Garantia de coima.** Se um boletim falhar por falha da plataforma, a plataforma paga a coima (teto por conta, condicionada a check-in online feito a tempo) | Inversão total de risco. Só é possível **porque** I1 existe e prova a culpa. Nenhum concorrente ousa | 4 + jurídico | 9 |
| **I3** | **Fila de divergência de preços** (Fase B do `SINCRONIZACAO.md`): decides aqui, o sistema diz exatamente o que mudar no Amenitiz/Booking, por quarto e intervalo, e regista quando foi aplicado | Transforma a ausência de API numa funcionalidade. É o mesmo modelo de dados que um `ChannelAdapter` enviará — nada se deita fora | 5 | 9 |
| **I4** | **Portal do contabilista**: um login para o contabilista ver **todos** os seus clientes AL — SAF-T, mapa de IRS, faturas, TMT. Grátis para ele | Transforma o canal em produto. Um contabilista com 30 clientes AL passa a ter incentivo próprio para os trazer. **Ninguém em Portugal tem isto** | 5 | 9 |
| **I5** | **Modo Férias**: o anfitrião vai de férias, as automações assumem, e só o crítico escala — com um resumo diário | Alívio emocional puro, quase zero custo depois do motor de automações | 3 | 7 |
| **I6** | **Simulador público "quanto rende o meu T2 em Faro"** com dados agregados anonimizados (k≥5) da própria base | Máquina de leads + SEO programático + impossível de copiar sem clientes. Efeito de rede real | 6 | 8 |
| **I7** | **Dossiê de transmissão de AL**: com o DL 76/2024, as licenças voltaram a ser transmissíveis. Gerar o pacote que um comprador exige — RNAL, seguro, conformidade, 3 anos de ocupação e receita auditáveis | Novo por causa de uma lei de 2024 que ninguém traduziu em produto. Cria um segundo momento de valor (venda do imóvel) | 3 | 7 |
| **I8** | **Verificador do número de registo nos anúncios** (Reg. UE 2024/1028): confirma que o RNAL está visível e correto em cada plataforma, e avisa antes de a plataforma despublicar | Obrigação **nova em toda a UE desde maio de 2026**. Ninguém a cobre ainda. Escala para ES/IT sem alterar o motor | 4 | 8 |
| **I9** | **Preço por conta com "unidades ilimitadas" no escalão de topo** | Ataca frontalmente a economia de EazyAL, Lodgify, PriceLabs e Uplisting. Comercialmente violento e verdadeiro | 2 | 9 |
| **I10** | **Migração em 1 clique** a partir de Smoobu, Lodgify, Excel e **EazyAL/Hostkit** | Remove a única fricção que sobra depois de I9 convencer | 6 | 8 |

## 11. Inteligência artificial — o que fazer e como

O Concierge atual (Haiku, streaming, 6 idiomas) **gera texto que o anfitrião copia e cola**. Em 2026 isso está atrás do mercado: a GuestGuru automatiza a resposta no Airbnb por $1 no primeiro anúncio. A IA tem de deixar de ser um ecrã e passar a ser uma **camada de execução**.

### 11.1 Prioridades

| # | Aplicação | Porquê agora |
|---|---|---|
| A1 | **Extração de documento com saída estruturada** (`output_config.format` / `strict: true`) em vez de texto livre | O OCR do check-in alimenta campos legais do SIBA. Um schema estrito elimina a classe inteira de erros de parsing e reduz o custo de validação. Manter `claude-sonnet-4-6` para visão |
| A2 | **Auditor de conformidade**: varre a conta e devolve "3 boletins por submeter, prazo em 14 h · TMT de julho por declarar · seguro expira em 12 dias" | É a feature que faz abrir a app. Praticamente todo o input já existe em `lib/compliance.ts` |
| A3 | **Explicação de números**: "setembro caiu 18 %: 60 % por menos reservas do Booking, 40 % por ADR mais baixo" | Diferenciador barato sobre dados próprios |
| A4 | **Redator de anúncios multilingue** + **resposta a avaliações** (3 níveis de firmeza) | Valor percebido alto, custo trivial. Candidatos naturais à **Batches API (50 % do custo)** por não serem sensíveis a latência |
| A5 | **Auto-resposta com aprovação num toque** (depende da caixa de entrada) | Paridade com Hospitable/GuestGuru |
| A6 | **Agente de conformidade autónomo** — com aprovação prévia, submete SIBA, emite fatura e prepara o INE, com registo auditável | Candidato natural a **Managed Agents** (sessões persistentes, ferramentas do lado do servidor, eventos observáveis). Só depois de A2 e da governação |

### 11.2 Engenharia de IA — decisões concretas

- **Prompt caching** no bloco de sistema do Concierge e do auditor: o prefixo (instruções + contexto do alojamento) é estável e o custo cai substancialmente. Verificar sempre `usage.cache_read_input_tokens` — se vier a zero, há um invalidador silencioso (data/hora no prompt, JSON não ordenado).
- **Batches API** para tudo o que não é interativo (relatórios mensais, redação de anúncios, análise de avaliações): 50 % do custo.
- **IDs de modelo sem sufixo de data**: `claude-haiku-4-5`, `claude-sonnet-4-6`.
- **Governação antes de expandir** (ANF-11.1): teto de custo por conta, *kill switch*, log auditável de cada ação com efeito externo, e modo sugerir→aprovar antes de qualquer automatismo. Sem isto, o custo de IA e o risco reputacional escalam sem controlo.

---

# PARTE IV — EXECUÇÃO

## 12. Roadmap

Ordenado por **desbloqueio comercial**, não por dificuldade. A regra de julho mantém-se: software primeiro, dependências humanas em paralelo.

### FASE 0 — Não podes ter um segundo utilizador sem isto (semana 1–2)

| # | Tarefa | Dific. | Prior. | Tempo |
|---|---|---|---|---|
| 0.1 | 🔴 **Corrigir a copy da landing v2**: remover "caixa de entrada", "contrato eletrónico", trocar "atualização contínua" por "sincronização diária, com aviso de falha", qualificar o "+12 %" | 1 | 10 | 3 h |
| 0.2 | 🔴 **Migrar o Clerk para instância de produção** | 3 | 10 | 1 d |
| 0.3 | 🔴 **Rate limit distribuído** (Upstash Redis) | 3 | 10 | 1 d |
| 0.4 | 🔴 **Observabilidade**: Sentry + Vercel Analytics/Speed Insights + PostHog com o funil registo → 1.ª propriedade → 1.º iCal → 1.ª reserva → 1.º check-in | 3 | 10 | 2 d |
| 0.5 | 🔴 Encriptação de coluna dos campos de documento + log de acesso | 6 | 10 | 5 d |
| 0.6 | MFA no Clerk · PITR + restauro de ensaio | 2 | 9 | 1 d |

### FASE 1 — Paridade de conformidade (semanas 3–8)

| # | Tarefa | Dific. | Prior. | Tempo |
|---|---|---|---|---|
| 1.1 | 🔴 **SIBA por web service, a sério** — cofre encriptado de credenciais por alojamento (NIPC, estabelecimento, chave), gerador `BAL.XSD`, cliente SOAP com retry/backoff, máquina de estados por boletim, painel com contagem decrescente para o prazo de 3 dias úteis | 7 | 10 | 3 sem |
| 1.2 | 🔴 **I1 — prova de submissão arquivada** + dossiê ASAE em PDF | 3 | 10 | 1 sem |
| 1.3 | 🔴 **Faturação ligada de ponta a ponta** (o adaptador existe; falta conta InvoiceXpress, emissão automática no check-in/pagamento e envio ao hóspede) | 4 | 10 | 1,5 sem |
| 1.4 | 🔴 **Taxa turística: dos 5 concelhos atuais para 12** (falta Portimão, Lagos, Faro, Sintra, V. N. Gaia, Funchal, Óbidos) + mapa mensal pronto a submeter | 4 | 10 | 1 sem |
| 1.5 | **I8 — verificador do número de registo** (Reg. UE 2024/1028) | 4 | 9 | 4 d |
| 1.6 | Mapa fiscal IRS Cat. B (0,35) vs Cat. F + pacote para o contabilista | 4 | 8 | 2 sem |

### FASE 2 — Preço, prova e primeiros clientes (semanas 6–12, sobrepõe)

| # | Tarefa | Dific. | Prior. | Tempo |
|---|---|---|---|---|
| 2.1 | 🔴 **Novos escalões** (§13) + trial de 30 dias + grandfathering | 3 | 10 | 3 d |
| 2.2 | 🔴 **Screenshots reais e vídeo de 60 s** (gravação de ecrã, sem produção) | 3 | 10 | 3 d |
| 2.3 | 🔴 **Unificar a marca**: uma paleta, uma tipografia, landing e app iguais | 4 | 9 | 1 sem |
| 2.4 | Calculadora "quanto pagas por apartamento vs. por conta" no topo da landing, com captura de email | 3 | 9 | 2 d |
| 2.5 | Checklist de ativação persistente + estados vazios com ação | 3 | 9 | 4 d |
| 2.6 | Reativar `index` nos sites `/r/[slug]` (mecanismo pronto) | 1 | 9 | 4 h |

### FASE 3 — Operação diária e receita (semanas 12–24)

| # | Tarefa | Dific. | Prior. |
|---|---|---|---|
| 3.1 | **Entidade Tarefa + limpezas** (geração automática no checkout, PWA para a equipa, deteção de checkout+checkin no mesmo dia) | 6 | 10 |
| 3.2 | **Revenue management v1**: previsão 30/60/90, pace vs. ano anterior, noites órfãs, alertas com ação | 7 | 9 |
| 3.3 | **I3 — fila de divergência de preços** | 5 | 9 |
| 3.4 | Motor de automações genérico (gatilho → condição → ação → atraso) + 10 receitas | 7 | 9 |
| 3.5 | WhatsApp Business (Meta Cloud API) | 6 | 8 |
| 3.6 | Server Components nas 5 páginas mais pesadas + refactor de `/precos` | 6 | 8 |
| 3.7 | Caixa de entrada unificada (email + WhatsApp + ponte OTA por reencaminhamento) — **só depois de 0.1 remover a promessa** | 8 | 8 |
| 3.8 | Auditor de conformidade por IA (A2) + governação de IA | 5 | 9 |

### FASE 4 — Distribuição e alavancas (semanas 24–40)

3.x concluído →
**I4 portal do contabilista** · **I6 simulador público + SEO programático** · **I10 migração em 1 clique** · check-in premium (MRZ + assinatura com selo temporal) · Guest App PWA · guidebook por IA · upsells · MB WAY/Multibanco · fechaduras · **I2 garantia de coima** · RBAC e owner portal (só com procura confirmada) · API pública.

### FASE 5 — Europa (semana 40+)

EN/ES no produto · **Espanha** (SES.HOSPEDAJES, IVA, taxas autonómicas) · **Itália** (Alloggiati Web, ISTAT, cedolare secca) · adaptadores de canal (Booking Connectivity primeiro; Airbnb exige parceria formal e volume) · marca branca · SOC 2 se o segmento enterprise o exigir.

### FASE H — Dependências humanas (arrancar já, em paralelo)

| # | Tarefa | Quando |
|---|---|---|
| H1 | **Registar cada alojamento no portal SIBA em modo Web Service** e recolher estabelecimento + chave (1–3 dias úteis) | **Dia 1** — desbloqueia 1.1 |
| H2 | Conta InvoiceXpress (ou Vendus/Moloni) | Semana 1 — desbloqueia 1.3 |
| H3 | Pedir acesso à **API do Amenitiz** (painel → Definições → API) | **Dia 1** — custa um email |
| H4 | Decisão de orçamento: Vercel Pro (cron horário, domínios) + Supabase Pro | Semana 1 |
| H5 | Decisão de marca: `anfitriao.pt` vs `anfitrioes.pt` | Semana 1 |
| H6 | Revisão jurídica: T&C, RGPD, e **a garantia de coima (I2)** | Antes da Fase 4 |
| H7 | Primeiros 5 anfitriões beta reais (fora do círculo próximo) | Após Fase 0 |
| H8 | 3 contabilistas parceiros | Semana 12 |
| H9 | Contacto com a ALEP e associações regionais | Semana 16 |
| H10 | Verificação Meta Business (WhatsApp) | Semana 20 |

## 13. Pricing

### 13.1 Proposta

| Plano | Preço | Limite | Inclui |
|---|---|---|---|
| **Grátis** | 0 € | 1 alojamento, 5 reservas/mês | Calendário, iCal, check-in online, exportação SIBA, cofre de conformidade (só leitura), marca Anfitrião no site |
| **Essencial** | **29 €/mês** (24 € anual) | até 3 | + reservas ilimitadas, **SIBA automático**, faturação certificada, taxa turística, automações, site de reservas, IA básica |
| **Profissional** ⭐ | **59 €/mês** (49 € anual) | até 8 | + revenue management, fila de preços, IRS/SAF-T, portal do contabilista, domínio próprio, IA sem limite, INE |
| **Negócio** | **119 €/mês** (99 € anual) | **ilimitado** | + equipas, app de limpezas, owner portal, API, suporte prioritário |
| **Empresa** | sob consulta | — | SLA, migração assistida, marca branca, formação |

**Add-ons:** WhatsApp Business (+9 €) · Fechaduras (+7 €) · Pack Contabilista (+19 €, SAF-T e mapa fiscal) · Domínio próprio (+5 €).

### 13.2 Racional

> **Nota de 2026-08-17.** Os escalões abaixo foram desenhados contra concorrentes
> que cobram por unidade. Com o TalkGuest a €13,50–71,10 **por conta**, o
> Essencial a 29 € deixa de ser óbvio: entrega menos (sem channel manager por
> API, sem owner portal, sem app) por mais do dobro do plano de entrada deles.
> Antes de mexer nos preços, decidir o posicionamento (§9.1) — se a venda passa
> a ser conformidade com prova, o preço compara-se com o risco de uma coima, não
> com o preço de um PMS.

- **Trial de 30 dias**, não 14: o negócio é sazonal e 14 dias em janeiro não provam nada.
- Subir €19→€29 mantém-se abaixo de Smoobu e sinaliza qualidade. O €39 atual, para 10 propriedades, sinaliza "barato".
- **"Ilimitado" no Negócio a €119** é a arma contra o preço por listing: 20 unidades custam €200/mês só na EazyAL, e mais €400 na PriceLabs.
- **0 % de comissão sobre reservas** como bandeira permanente (Smoobu 0,9 %, Lodgify 1,9 %, Beyond 1–1,25 %).
- **Grandfathering** explícito dos atuais.
- Com churn de 3 %/mês e ARPU de €45, LTV ≈ €1.500 → justifica CAC até €300–400. Nada hoje explora isso.

### 13.3 A tabela de comparação que deve estar na landing

| | Anfitrião | EazyAL | Hostkit | Smoobu | Lodgify | PriceLabs |
|---|---|---|---|---|---|---|
| Modelo | **por conta** | por alojamento | por alojamento | por conta +% | por listing +1,9 % | por propriedade |
| 4 unidades/mês | **59 €** | ~40 € (só conformidade) | ~40 € (só conformidade) | ~31 € (sem conformidade) | ~100 €+ | ~80 € (só preços) |
| SIBA automático | ✅ (Fase 1) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Faturação AT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Taxa turística | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Revenue management | ✅ (Fase 3) | ❌ | ❌ | +€12,99/prop | +0,8 %/reserva | ✅ |
| Site + reservas diretas | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Comissão sobre reservas | **0 %** | 0 % | 0 % | 0,9 % | 1,9 % | — |

## 14. Plano de lançamento e marketing

### 14.1 Marca

Uma paleta (terracota sobre off-white quente, dark mode com decisão própria), um par tipográfico (uma display com carácter para títulos e números, uma neutra para dados, **`tabular-nums` obrigatório** em tudo o que é dinheiro), e a mesma identidade da landing ao produto. Decidir `anfitriao.pt` vs `anfitrioes.pt` e redirecionar permanentemente o outro.

### 14.2 Sequência de lançamento

| Etapa | Quando | Objetivo |
|---|---|---|
| **Mês de uso real** (`MES-DE-USO-REAL.md`) | agosto | A lista de atrito. Não pular, não corrigir a meio |
| **Beta fechado, 5 anfitriões** | após Fase 0 | O primeiro sinal a sério. Onboarding feito à mão, um a um, com o fundador presente |
| **Beta alargado, 25 anfitriões** | após Fase 1 | Conformidade a funcionar em contas que não são a do fundador. **Só aqui é que há testemunhos** |
| **Lançamento público** | após Fase 2 | Preço novo, prova visual, garantia de 30 dias |
| **Época alta 2027** | primavera 2027 | O objetivo comercial real |

### 14.3 Canais, por CAC esperado

1. **Contabilistas** (melhor CAC). Portal grátis (I4) + 20 % recorrente. Um contabilista com 30 clientes AL é um canal inteiro.
2. **SEO de conformidade**. Não competir de frente com a EazyAL na cauda longa — competir em **ferramentas**: calculadora de taxa turística por concelho, simulador de IRS Cat. B vs Cat. F, verificador de RNAL, simulador de rendimento (I6). Ferramentas ganham backlinks; artigos não.
3. **Comparação**: `/vs/eazyal`, `/vs/hostkit`, `/vs/smoobu`, `/vs/lodgify`, `/vs/amenitiz`, `/alternativas/[x]`. As páginas `/vs/` já existem — atualizar com os concorrentes reais.
4. **Comunidades**: grupos de AL no Facebook, ALEP, associações regionais (Algarve, Madeira, Porto). Presença do fundador, não anúncios.
5. **Sites dos tenants** como backlinks assim que forem indexáveis.
6. **Pago**: só depois de conhecer a conversão. Sem PostHog, gastar em Google Ads é queimar dinheiro às cegas.

### 14.4 Métricas

| Métrica | Hoje | 3 meses | 12 meses |
|---|---|---|---|
| Clientes pagantes | **0** | 25 | 250 |
| MRR | **0 €** | €900 | €12.000 |
| Conversão visita → registo | desconhecida | 4 % | 8 % |
| Ativação (1.º iCal ligado em 24 h) | desconhecida | 55 % | 75 % |
| Boletins SIBA submetidos automaticamente | 0 | 500 | 15.000 |
| Churn mensal | — | <5 % | <3 % |
| NPS | — | 40 | 60 |

**Métrica-norte proposta:** *obrigações legais cumpridas automaticamente por conta ativa e por mês.* Mede exatamente o valor entregue, é impossível de inflacionar, e alinha produto e comercial.

## 15. Internacionalização

Só depois de 100 clientes em Portugal. O motor é o mesmo; muda a tabela de obrigações.

| Mercado | Obrigações equivalentes | Dificuldade | Notas |
|---|---|---|---|
| **Espanha** | SES.HOSPEDAJES (partes de viajero), IVA, taxas turísticas autonómicas, registo único | 8 | Mercado 4× maior, mesma dor, Reg. UE 2024/1028 a forçar registo único |
| **Itália** | Alloggiati Web, ISTAT, tassa di soggiorno, CIN | 8 | Estrutura quase idêntica à portuguesa |
| **Grécia / Croácia** | eVisitor, registo AMA | 7 | Mercados pequenos, concorrência quase nula |
| **França** | déclaration en mairie, taxe de séjour | 7 | Mais regulado, mais concorrência |

**Sequência técnica:** abstrair `ComplianceProvider` por país (o `InvoicingAdapter` já é o molde) → i18n do produto (EN primeiro, ES a seguir) → `hreflang` → conteúdo local. O Reg. UE 2024/1028 é o argumento comum a todos: uma só plataforma para as obrigações de qualquer Estado-Membro.

## 16. Decisões pendentes (só o que depende mesmo do utilizador)

| # | Decisão | Assumido entretanto | Bloqueia |
|---|---|---|---|
| 1 | **Registar os alojamentos no SIBA em modo Web Service** (portal → área reservada → modo de envio) | Que vai ser feito, e que a implementação avança em paralelo | Fase 1.1 — o item de maior valor de todo o plano |
| 2 | **Instância de produção do Clerk** — implica refazer configuração e, se for para RLS, o template JWT | Que se faz antes do segundo utilizador | Tudo o que envolva clientes reais |
| 3 | **Orçamento**: Vercel Pro (cron horário, domínios de tenant) + Supabase Pro + Upstash | Que sim, na ordem Upstash → Vercel Pro → Supabase Pro | 0.3, 2.6, sincronização horária |
| 4 | **Conta InvoiceXpress** (ou Vendus/Moloni) | InvoiceXpress, porque o adaptador já está escrito | 1.3 |
| 5 | **Marca**: `anfitriao.pt` vs `anfitrioes.pt` | `anfitrioes.pt`, por ser o que está em produção e indexado | SEO e todo o material |
| 6 | **Preços novos** (§13) e grandfathering | Escalões propostos, trial de 30 dias | 2.1 |
| 7 | **Garantia de coima (I2)** — precisa de parecer jurídico e teto de exposição | Que fica para a Fase 4, depois de I1 provar a fiabilidade | I2 |
| 8 | **Retenção do `audit_log` e dos dados de conta após cancelamento** | 3 anos para o audit_log, 30 dias para a conta | Fecho do registo de tratamentos |
| 9 | **Indexar `/r/[slug]`** — depende da aprovação do site finalizado | Que aprova depois do mês de uso real | 2.6 |
| 10 | **RBAC/owner portal** — continua adiado até haver procura | Mantido adiado | Segmento de gestão profissional |

---

## Anexo — executado a 2026-08-02/03, logo após esta auditoria

| # | Item | Estado |
|---|---|---|
| 0.1 | Copy enganosa da landing corrigida (caixa de entrada, contrato eletrónico, "atualização contínua", "+12 %") e FAQ nova sobre a latência do iCal | ✅ em produção |
| 1.1 | **SIBA por web service** — `siba-xml.ts` (MovimentoBAL + SOAP + leitura da resposta), `siba-mapping.ts` (tradução dos dados da app), `siba-api.ts` (3 tentativas, recuo exponencial), migrações 030/031, formulário em `/conformidade`, `pais_residencia` no check-in | ✅ em produção, à espera de credenciais |
| 1.2 | **I1 — prova de submissão**: tabela `siba_submissoes` com o SHA-256 do que foi enviado e a resposta em bruto | ✅ |
| 0.5 (parcial) | `crypto.ts` (AES-256-GCM) — a chave de acesso ao SIBA é guardada encriptada; sem `APP_ENCRYPTION_KEY` a app **recusa** gravar em vez de guardar em claro. Mesma base para os campos de documento | ✅ |
| — | `/api/properties` deixou de devolver a chave encriptada ao browser | ✅ |
| D2 | Índices compostos `(owner_id, …)` em `bookings` e `expenses` (migração 032) | ✅ aplicado |
| T5 | ID de modelo sem sufixo de data (`claude-haiku-4-5`) | ✅ |

**Testes: 345 → 435.** Typecheck, ESLint e build limpos.

### Duas correções de facto encontradas ao executar

1. **Deriva de esquema.** `properties.id`, `bookings.id` e `guests.id` são `text` em produção, apesar de a migração 001 os declarar `UUID`. As migrações não são a fonte de verdade da base — quem escrever DDL a partir dos ficheiros vai falhar, como falhou aqui à primeira. Vale um `schema.sql` gerado da produção.
2. **Taxa turística: não expandida, deliberadamente.** A fonte primária do projeto (guia da ALerta) cobre exatamente os 5 concelhos já implementados, e confirma que **Lagos não cobra taxa**. Para Faro, Portimão e Funchal só encontrei blogues, com valores em desacordo entre si — e uma das fontes dava **Cascais a €1** quando o valor correto é **€4 desde janeiro de 2025** (o código está certo). Publicar um valor errado aqui cobra dinheiro a mais a hóspedes reais. Fica por fazer até haver leitura dos regulamentos municipais.

---

## Nota final

O plano de julho estava certo em quase tudo menos na coisa mais importante: **não há um fosso vazio à espera**. Há dois portugueses a cavá-lo desde antes deste projeto começar, e ambos já entregam aquilo que a landing do Anfitrião promete.

~~O que existe, e é real, é uma janela de 12 a 18 meses e três vantagens que nenhum deles tem: **preço por conta**, **amplitude de produto** e **velocidade de execução**.~~

**Corrigido a 2026-08-17.** Das três, só a terceira resiste. O preço por conta é do TalkGuest também, e mais barato; a amplitude é dele também, e maior (channel manager por API, owner portal, app móvel, tarefas). A velocidade de execução mantém-se — e nestes quinze dias produziu conformidade com prova, boletim por pessoa, RGPD por código e faturação no NIF do anfitrião, que é onde a vantagem verdadeiramente está.

Nada disso conta enquanto a página inicial prometer uma caixa de entrada que não existe e o SIBA devolver 501. **O caminho mais curto para o mercado é fechar essa distância entre o que se diz e o que se faz — e o web service do SIBA, que se pensava bloqueado, é a peça que a fecha.**

---

### Fontes consultadas (2026-08-02)

- [SIBA — Modos de Envio (web service, WSDL, parâmetros)](https://siba.ssi.gov.pt/en/ajuda/modos-de-envio/) · [SIBA — Perguntas Técnicas](https://siba.ssi.gov.pt/en/ajuda/perguntas-tecnicas/) · [node-siba (referência de formato)](https://github.com/rafaelrpinto/node-siba)
- [EazyAL — funcionalidades e preços](https://www.eazyal.com/) · [EazyAL — SIBA WebService Troubleshooting 2026](https://www.eazyal.com/blog/siba-webservice-troubleshooting) · [EazyAL — taxa turística por município](https://www.eazyal.com/blog/complete-guide-to-the-municipal-tourist-tax)
- [Hostkit — faturação para alojamento local](https://hostkit.pt/software-faturacao-alojamento-local/) · [Hostkit — boletins SIBA automáticos](https://hostkit.pt/boletins-sef-siba-alojamento-local/)
- [Chekin — boletins de alojamento, coimas e integração](https://chekin.com/pt/blog/boletins-de-alojamento/) · [Chekin — Regulamento (UE) 2024/1028](https://chekin.com/en/blog/regulation-eu-2024-1028/)
- [EUR-Lex — Regulamento (UE) 2024/1028](https://eur-lex.europa.eu/eli/reg/2024/1028/oj/eng) · [Minut — o que muda em maio de 2026](https://www.minut.com/blog/eu-short-term-rental-regulations)
- [Turismo de Portugal — alteração ao regime jurídico do AL](https://business.turismodeportugal.pt/pt/Planear_Iniciar/Como_comecar/Alojamento_Local/Paginas/alteracao-regime-juridico-alojamento-local.aspx) · [Chekin — licença de AL 2026](https://chekin.com/pt/blog/licenca-alojamento-local/)
- [StaySTRA — PriceLabs vs Wheelhouse vs Beyond 2026](https://staystra.com/pricelabs-vs-wheelhouse-vs-beyond-pricing-2026/) · [StaySTRA — monitores de ruído 2026](https://staystra.com/best-noise-monitor-short-term-rental-2026-minut-noiseaware-party-squasher/)
- [Guest Guru — preços](https://guestguru.ai/pricing/) · [Booking.com — Connectivity APIs](https://developers.booking.com/connectivity/docs)
