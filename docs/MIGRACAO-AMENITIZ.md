# Migração do Amenitiz para o Anfitrião

_2026-09-01. Plano de execução. Substitui a secção 4 (Recomendação) de
`docs/SINCRONIZACAO.md`, que continua válida para o resto._

---

> **Atualização 2026-09-02 — a disponibilidade passou a ser verificada ao
> vivo.** A secção «A conclusão, primeiro» continua a valer para a gestão de
> canais, mas a parte que nos cabia está fechada: nenhuma reserva é aceite sem
> se perguntar às plataformas, no momento, se a noite ainda está livre. Ver
> **Atualização online** mais abaixo e `lib/disponibilidade-ao-vivo.ts`.

## A conclusão, primeiro

**O Amenitiz não sai já, e a parte dele que gere os canais provavelmente não
sai este ano.** Tudo o resto pode passar para o Anfitrião em semanas, com risco
próximo de zero e reversível a qualquer momento.

A razão é uma só e não se resolve com trabalho: **o Anfitrião fala com as
plataformas por iCal, e o iCal é lento.** Hoje a sincronização corre **uma vez
por dia, às 04:00** (`vercel.json`). Do lado de lá, cada plataforma lê os feeds
quando lhe apetece — não há garantia de intervalo. Com o Amenitiz no meio, isso
não custa nada: ele mantém o Airbnb e o Booking sincronizados **por API**, e o
atraso do iCal afeta só aquilo que o Anfitrião *mostra*. Sem ele, esse atraso
passa a ser a janela em que duas plataformas podem vender a mesma noite.

> Uma reserva entra no Airbnb → aparece no feed do Airbnb (latência deles) →
> lemos até 24 h depois → sai no nosso feed → o Booking lê (latência deles).
> **Bem mais de 24 horas** com a noite à venda nos dois sítios.

Não é uma limitação desta aplicação: o formato iCal transporta datas ocupadas e
mais nada — nem preços, nem estadias mínimas, nem restrições. Um gestor de
canais a sério escreve por API. Enquanto o Anfitrião não tiver a API do
Amenitiz (**H3**) ou ligação direta às OTA, tirar o Amenitiz do meio é trocar
uma mensalidade por um risco de overbooking. **Não se faz.**

O que se segue é como migrar tudo o que **não** é isso — que é a maior parte do
valor, e onde estão as horas do teu dia.

---

## Atualização online — as três direções do problema

«Overbooking» não é um problema só: são três, com donos diferentes. Vale a pena
separá-los, porque dois deles já estão resolvidos e o terceiro não é nosso.

### A · Uma plataforma vendeu → o nosso site vende a mesma noite

**A única em que a dupla reserva é causada por nós. Resolvida a 2026-09-02.**

Nenhuma reserva é aceite sem se ler, **naquele segundo**, os feeds das
plataformas e confirmar que a noite continua livre
(`lib/disponibilidade-ao-vivo.ts`). Ligado aos quatro caminhos que criam
reservas: pedido direto, casa inteira, o do anfitrião em `/reservas/nova`, e a
reconfirmação depois do pagamento. Custa 1–2 segundos, uma vez por reserva.

Não depende do cron, não depende do plano da Vercel e não depende do Amenitiz.

> ⚠️ **Fecha por omissão.** Se um feed não responde, a reserva é recusada em vez
> de aceite às cegas. Isto tem um custo real que tens de conhecer: **um
> endereço iCal partido trava as reservas diretas até ser arranjado.** É a
> escolha certa para o teu critério — perder uma reserva é reversível e aparece
> em `/canais` como feed «desatualizado»; uma dupla reserva é uma pessoa sem
> casa. Se preferires o contrário, muda-se numa linha; diz.

### B · Nós vendemos → uma plataforma vende a mesma noite

**Resolvida na parte que controlamos.** Uma reserva direta entra na nossa base
no instante em que é criada, e o feed que exportamos reflete-a com **5 minutos**
de cache. O que não controlamos é a rapidez com que o Amenitiz lê esse feed — e
é por isso que o Amenitiz fica: assim que ele sabe, empurra para o Airbnb e para
o Booking **por API**, que é instantâneo.

### C · Uma plataforma vendeu → outra plataforma vende a mesma noite

**Não é nossa, e é a razão de fundo para o Amenitiz ficar.** Enquanto ele for o
gestor de canais, isto passa por API entre plataformas e nunca chega ao iCal.

### O que continua a ser diário, e não é grave

A sincronização das 04:00 é o que enche o **calendário que vês**. Entre duas
passagens, uma reserva feita no Airbnb pode não estar visível em `/hoje` ou
`/calendario` durante algumas horas. Já não é um risco de dupla reserva — é uma
vista desatualizada, e a verificação ao vivo trava a reserva mesmo que o ecrã
diga o contrário.

**Se quiseres também o ecrã ao minuto**, o caminho é o plano **Vercel Pro**
(~20 €/mês): confirmei por API que a conta está em **Hobby**, onde os cron jobs
só correm uma vez por dia. Com Pro passa a poder correr de 15 em 15 minutos, e
é uma linha no `vercel.json`. É uma decisão de orçamento, não técnica — e não
é necessária para evitar overbooking.

---

## O que se migra, e por que ordem

| Fase | O que passa para o Anfitrião | Risco | Reversão |
|---|---|---|---|
| **0** | Nada. Fecham-se os bloqueios. | — | — |
| **1** | Ver o calendário | Nenhum | Apagar os feeds |
| **2** | Operação: check-in, SIBA, faturação, financeiro, hóspedes | Baixo | Voltar ao Amenitiz |
| **3** | Reservas diretas e o site | Médio | Desligar o site |
| **4** | Gestão de canais | **Alto — bloqueado** | Não aplicável |

Cada fase é útil sozinha e nenhuma se deita fora. Só se avança quando a
anterior tiver corrido **um mês inteiro** sem surpresas.

---

## Fase 0 — Antes de tocar em nada

Nenhuma destas é opcional, e nenhuma é código: são chaves e contas.

- [ ] **`RESEND_API_KEY` + `EMAIL_FROM` em produção.** Confirmado a 2026-09-01
  por `vercel env ls production`: o `EMAIL_FROM` está lá, **a chave não**. Sem
  ela não sai um único email — nem confirmação de reserva, nem link de
  check-in, nem lembrete de pagamento, nem alerta de conformidade. O código
  todo está escrito e deployado, e engole tudo em silêncio. É o primeiro
  bloqueio e o mais barato de tirar.
- [ ] **Clerk em instância de produção** (TODO 0.2). Ainda em chaves de
  desenvolvimento.
- [ ] **Observabilidade** (TODO 0.4). Sem Sentry, uma falha em produção
  descobre-se por acaso — foi assim que os emails passaram semanas desligados.
  A partir da Fase 2 há dinheiro e prazos legais em cima disto.
- [ ] **Cópia de segurança com restauro ensaiado** (TODO 0.6, PITR). Antes de
  a base ter reservas reais, e não depois.
- [ ] **Guardar o `APP_ENCRYPTION_KEY` fora do repositório** — já está gerado.
  Perdê-lo depois de haver dados encriptados é perder as credenciais do SIBA e
  da faturação.

**Só se avança quando estas cinco estiverem fechadas.**

---

## Fase 1 — Espelho (1 mês)

O Amenitiz manda em tudo. O Anfitrião **só olha**.

### O que fazer

1. No Amenitiz, tirar o endereço iCal **de cada quarto** (Quarto Individual,
   Quarto de Casal, Quarto Familiar).
2. No Anfitrião: Propriedades → Editar → Calendários externos, um feed por
   quarto. **A Casa de Vasco não leva nenhum** — a ocupação vive nos quartos.
3. **Não ligar o Airbnb nem o Booking diretamente.** O Amenitiz já os agrega;
   ligar os dois caminhos traz a mesma reserva com identificadores diferentes,
   a deduplicação por UID não a apanha, e a ocupação passa dos 100 %. A app
   avisa quando se tenta (`deveAvisarDuplicacao`).

```
Airbnb ─┐
Booking ─┼──► Amenitiz ──iCal──► Anfitrião   ✅  (Fase 1 e 2)
Vrbo ───┘
```

### O que verificar, e com que frequência

| Quando | O quê | Onde |
|---|---|---|
| Todos os dias, 1 min | Os 3 feeds dizem «ligado», não «desatualizado» | `/canais` |
| Todos os dias, 2 min | O calendário do Anfitrião = o do Amenitiz | `/calendario` |
| Ao fim do mês | Quantas vezes mexeste em preços | à mão |

A regra das 36 horas (`lib/canais.ts`) marca como desatualizado o feed que
falhou pelo menos uma noite. **Um feed desatualizado nesta fase não tem
consequência nenhuma** — é exatamente para isso que a fase existe: descobrir
como é que ele falha antes de alguma coisa depender dele.

### O que já não pode correr mal

Três das quatro maneiras conhecidas de perder uma reserva na sincronização
foram fechadas a 2026-09-01 e estão em produção:

- Uma reserva cancelada por engano nosso **volta sozinha** se o UID reaparecer
  no feed. Antes ficava cancelada para sempre, com o quarto a dizer-se livre.
- Um feed que ontem trazia reservas e hoje vem vazio **não cancela nada**.
- O feed que exportamos deixou de ser cortado às mil linhas e devolve **503 em
  vez de um calendário incompleto** quando a leitura falha.

### Reversão

Apagar os feeds. O Amenitiz nunca soube que isto existiu.

### Como se sabe que a fase acabou bem

Um mês completo em que o calendário do Anfitrião nunca esteve errado, e a
resposta escrita à pergunta «quantas vezes mexi em preços este mês?».

---

## Fase 2 — A operação passa para cá (1 mês)

O Amenitiz continua a ser o gestor de canais. O Anfitrião passa a ser **onde
vives o dia a dia**. É aqui que está quase todo o valor da migração, e o risco
continua baixo porque nada disto toca na disponibilidade.

### O que passa

- **`/hoje`** — entradas, saídas, quem está em casa.
- **Check-in online** — o hóspede preenche os dados antes de chegar.
- **SIBA por web service** — depende de **H1**: registar cada alojamento no
  portal SIBA em modo «Web Service» e obter NIPC, número de estabelecimento e
  chave. Resposta em 1–3 dias úteis, credenciais são tuas, não da plataforma.
  ⚠️ **Validar primeiro contra `/bawsdev/`** (`SIBA_WS_URL`) antes do primeiro
  envio real. Um boletim em falta são 100–2.000 € por hóspede.
- **Faturação certificada** — depende de **H2** (conta de parceiro
  InvoiceXpress) e da variável `INVOICEXPRESS_PARTNER_API_KEY`.
- **Financeiro** — despesas, comissões por plataforma, lucro líquido.
- **Hóspedes** — fichas, notas, histórico.

### Regra que não se quebra nesta fase

**As reservas continuam todas a nascer no Amenitiz ou nas plataformas.** No
Anfitrião não se cria nenhuma reserva à mão que o Amenitiz não conheça — se o
fizeres, ela não vai para canal nenhum e o quarto continua à venda.

### Reversão

Voltar a fazer a operação no Amenitiz. Os dados ficam cá e não se perdem.

### Como se sabe que a fase acabou bem

Um mês de boletins SIBA aceites, faturas emitidas com os números certos, e
nenhuma vez em que precisaste de abrir o Amenitiz para saber quem chegava.

---

## Fase 3 — Reservas diretas (a primeira em que escrevemos no mundo)

Aqui o Anfitrião deixa de ser só leitor. Uma reserva feita no teu site tem de
bloquear as plataformas — e o caminho é o feed que exportamos.

```
Anfitrião ──iCal──► Amenitiz ──API──► Airbnb / Booking / Vrbo
```

### Duas coisas a resolver **antes**, não durante

1. **O feed de exportação não pode devolver ao Amenitiz o que veio dele.**
   Hoje `/api/ical/[propertyId]` exporta todas as reservas ativas do
   alojamento, incluindo as que importámos dos feeds do próprio Amenitiz.
   Devolvê-las é, no melhor caso, redundante; no pior, um bloqueio nosso por
   cima de uma reserva dele que ninguém sabe desfazer. **Recomendação:** um
   feed que exporte só as reservas **diretas** (sem `uid_externo`). É uma
   alteração pequena e é decisão tua se fica noutro endereço ou no mesmo com
   um parâmetro — diz e implemento.

2. ~~**A frequência da sincronização.**~~ **Resolvido a 2026-09-02**, e não pela
   frequência: a disponibilidade passou a ser confirmada ao vivo no momento de
   aceitar a reserva (secção «Atualização online», acima). O cron diário deixou
   de estar no caminho crítico — continua a encher o calendário que vês, e o
   plano Vercel Pro só é preciso se quiseres esse ecrã ao minuto.

### Verificação obrigatória, com dados a sério

Reservar uma noite no próprio site e confirmar, **pelo Amenitiz e pelo
extranet do Airbnb**, que a noite ficou bloqueada nos dois. Depois cancelar e
confirmar que se libertou nos dois. Prefixar os dados com `TESTE-E2E` e apagar
no fim, como manda o `CLAUDE.md`.

### Reversão

Desligar o site público (`/website` → desativar). As reservas diretas voltam a
entrar pelo Amenitiz.

---

## Fase 4 — Gestão de canais: bloqueada, e porquê

Esta é a fase que tira o Amenitiz. **Não tem data e não deve ter**, enquanto
uma destas três não existir:

| Caminho | O que exige | Prazo realista |
|---|---|---|
| **API do Amenitiz** (H3) | Pedir acesso no painel: Definições → API. Escalão Pro/Enterprise. | Semanas. É o mais curto. |
| **Booking Connectivity Partner** | Candidatura + certificação | 3–6 meses |
| **API do Airbnb** | Parceria formal, difícil de obter | Incerto |

**Pede a API do Amenitiz hoje.** Custa um email, a resposta demora o que
demora, e sem ela esta fase não existe. Pede já, decide depois.

Entretanto, a Fase B do `docs/SINCRONIZACAO.md` — a fila de «por aplicar», em
que decides os preços cá e o Anfitrião te diz o que mudar lá — continua a ser a
coisa mais valiosa a construir, **se** o mês da Fase 1 mostrar que mexes em
preços com frequência. Se mexeres duas vezes por ano, é exagero. Essa conclusão
não se pode tirar antes do mês.

---

## O que fazer se correr mal

| Sintoma | Causa mais provável | O que fazer |
|---|---|---|
| Feed «desatualizado» em `/canais` | Endereço mudou no Amenitiz | Remover e voltar a adicionar o feed. O UID de origem é reconhecido, não duplica. |
| Reserva no Amenitiz que não está cá | Sincronização ainda não correu | Sincronizar à mão na página do alojamento |
| Reserva cá que já não está no Amenitiz | Cancelada lá | A sincronização cancela-a na próxima passagem, com nota no histórico |
| Reserva cancelada cá sem razão | Falha parcial do feed | Volta sozinha quando o UID reaparecer. Se não voltar, o cancelamento não foi da sincronização — ver o histórico da reserva. |
| Calendário cá com o dobro das reservas | Airbnb ligado **e** Amenitiz ligado | Apagar os feeds diretos das plataformas. Só o Amenitiz. |
| Reservas diretas recusadas com «não foi possível confirmar a disponibilidade» | Um feed partido — a verificação ao vivo fecha por omissão | `/canais`: o feed em causa está «desatualizado». Corrigir o endereço. **Enquanto não for corrigido, não entram reservas diretas** — é deliberado |
| Duas pessoas para a mesma noite | Direção B ou C (ver «Atualização online») | Não é a direção que controlamos. Confirmar que o Amenitiz está a ler o nosso feed e que continua a ser ele o gestor de canais |

---

## Dependências humanas, por ordem de urgência

1. **`RESEND_API_KEY`** — bloqueia a Fase 0. Minutos.
2. **API do Amenitiz (H3)** — não bloqueia nada agora e bloqueia tudo depois.
   Um email, hoje.
3. **H1 · SIBA** — bloqueia a Fase 2. 1–3 dias úteis por alojamento.
4. **H2 · InvoiceXpress** — bloqueia a faturação na Fase 2.
5. **Clerk de produção, Sentry, PITR** — bloqueiam a Fase 0.
6. **Plano da Vercel** — confirmado **Hobby** (cron só uma vez por dia). Já
   **não** bloqueia nada: só decide se o calendário que vês está ao minuto ou
   ao dia. ~20 €/mês, decisão de orçamento.
