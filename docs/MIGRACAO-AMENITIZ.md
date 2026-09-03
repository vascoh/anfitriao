# Migração do Amenitiz para o Anfitrião

_2026-09-01. Plano de execução. Substitui a secção 4 (Recomendação) de
`docs/SINCRONIZACAO.md`, que continua válida para o resto._

---

> 🔴 **Atualização 2026-09-03 — o feed do Amenitiz não traz reservas.**
> Medido, não suposto: os três feeds respondem
> `PRODID:Amenitiz Availability iCalendar` e **todos** os eventos dizem
> `SUMMARY:Quarto indisponível`, sem hóspede, sem preço e sem dizer de que
> plataforma vêm. É um calendário de *disponibilidade*.
>
> Isto invalida a Fase 2 tal como estava escrita: check-in online, boletim SIBA
> e faturação precisam de saber **quem** chega, e o feed só diz **quando** o
> quarto está fechado. A **API do Amenitiz (H3)** deixa de destrancar a Fase 4
> e passa a ser pré-requisito da Fase 2. Ver «O muro por baixo do muro».
>
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
> escolha certa para o teu critério — perder uma reserva é reversível; uma
> dupla reserva é uma pessoa sem casa. Se preferires o contrário, muda-se numa
> linha; diz.
>
> **Desde 2026-09-02 isso não passa despercebido**: um cron às 06:00 avisa-te
> por push e por email quando um calendário está em erro ou sem leituras há
> mais de um dia (`lib/canais-alertas.ts`). O aviso diz o que está a custar, e
> não só que existe. Antes ficava um crachá em `/canais` à espera de uma visita
> que ninguém faz.

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

## O muro por baixo do muro

O documento sempre disse que o iCal não transporta preços nem restrições. O que
se descobriu a 2026-09-03, com o feed à frente, é pior e mais específico:

**O export do Amenitiz não transporta reservas de todo.**

```
BEGIN:VCALENDAR
PRODID:Amenitiz Availability iCalendar     ← disponibilidade, não reservas
BEGIN:VEVENT
UID:f199cc0d-9987-5534-b9cf-da72ea0066f2
DTSTART;VALUE=DATE:20260902
DTEND;VALUE=DATE:20260923
SUMMARY:Quarto indisponível                ← sem hóspede, sem preço, sem canal
END:VEVENT
```

Um evento por período fechado. Não diz quem chega, não diz de que plataforma
veio, e nem sequer diz se aquele bloco é uma reserva ou o anfitrião a fechar o
quarto. Três quartos, três eventos.

### E funde o que estiver seguido — confirmado a 2026-09-03

O evento acima, `03→23`, não é uma reserva de vinte noites. No Amenitiz há ali
**uma reserva até dia 8 e um bloqueio de 8 a 22**: duas coisas distintas, com
naturezas diferentes, exportadas como um intervalo só.

As contas batem certo — ocupado de 3 a 22, livre no dia 23 — mas **a fronteira
entre elas desapareceu no ficheiro**. Não há como a app a reconstruir: a
informação não está lá.

Isto é mais grave do que «não traz hóspedes». Significa que, por iCal, o
Anfitrião **nunca** verá as reservas uma a uma — vê blocos de indisponibilidade
que podem conter qualquer número delas. A lista de reservas, a contagem, a
ocupação por reserva e o histórico do hóspede ficam todos fora de alcance,
independentemente do que se escreva deste lado.

### O que isto permite, e o que não permite

| | Com o feed do Amenitiz |
|---|---|
| Ver que noites estão ocupadas | ✅ |
| Impedir uma dupla reserva no site próprio | ✅ (é o que a verificação ao vivo usa) |
| Ocupação e RevPAR | ⚠️ conta noites fechadas, não reservas |
| Saber **quem** chega | ❌ |
| Check-in online | ❌ não há a quem mandar o link |
| Boletim SIBA | ❌ não há pessoa para comunicar |
| Faturação | ❌ não há nome, NIF nem valor |
| Comissão por plataforma | ❌ não diz de que canal veio |

As quatro últimas eram **a Fase 2 inteira**. Não se resolvem com trabalho deste
lado: a informação não está no ficheiro.

### As saídas, por ordem de custo

1. **API do Amenitiz (H3).** Passa a ser o item mais importante da lista toda.
   Pede-se no painel (Definições → API), custa um email e a resposta demora o
   que demorar. Sem ela, a Fase 2 não existe.
2. **Ligar o Airbnb e o Booking diretamente** — em vez do Amenitiz, nunca os
   dois. Depois do que se confirmou a 03/09, esta opção **subiu de valor**: as
   OTA exportam um evento **por reserva**, com identificador próprio, em vez de
   um bloco que funde tudo. Isso devolve as fronteiras entre reservas, a
   contagem certa e a atribuição por canal — que o feed do Amenitiz não dá de
   maneira nenhuma.
   Continua sem nome nem email, portanto não resolve o check-in nem o SIBA.
   ⚠️ **Por verificar antes de mudar**: que o feed de cada OTA traz mesmo as
   reservas separadas, e o que acontece aos bloqueios postos no Amenitiz (devem
   propagar-se às OTA, mas isso vê-se com o ficheiro à frente, não por
   dedução).
3. **Aceitar que a operação fica no Amenitiz** e usar o Anfitrião para o que
   não depende de hóspedes: conformidade, dossiê ASAE, financeiro, preços,
   site próprio. É a opção honesta enquanto 1 não chegar.

---

## O que se migra, e por que ordem

| Fase | O que passa para o Anfitrião | Risco | Reversão |
|---|---|---|---|
| **0** | Nada. Fecham-se os bloqueios. | — | — |
| **1** | Ver o calendário | Nenhum | Apagar os feeds |
| **2** | Operação: check-in, SIBA, faturação | **🔴 bloqueada — precisa da API (H3)** | — |
| **2b** | Conformidade, dossiê, financeiro, preços | Baixo | Voltar ao Amenitiz |
| **3** | Reservas diretas e o site | Médio | Desligar o site |
| **4** | Gestão de canais | **Alto — bloqueado** | Não aplicável |

Cada fase é útil sozinha e nenhuma se deita fora. Só se avança quando a
anterior tiver corrido **um mês inteiro** sem surpresas.

A Fase 2 partiu-se em duas quando se percebeu que metade dela dependia de dados
que o feed não traz. A **2b** é a parte que não depende de hóspedes nenhuns, e
essa pode arrancar já.

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

1. No Amenitiz: **Channel Manager → iCals**, e copiar o endereço **de cada
   quarto** (Quarto Individual, Quarto de Casal, Quarto Familiar).
2. No Anfitrião: **Alojamentos → Canais → Ligar uma plataforma → Gestor de
   canais**. Um feed por quarto. **A Casa de Vasco não leva nenhum** — a
   ocupação vive nos quartos.
   _(Feito a 2026-09-02: os três estão ligados.)_
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

### O que a primeira ligação já respondeu (2026-09-02)

Duas das perguntas que esta fase existia para responder ficaram respondidas na
primeira hora, e as respostas não foram as esperadas:

- **O feed traz reservas?** Não. Traz períodos fechados — ver «O muro por baixo
  do muro». Foi assim que se descobriu.
- **Cada reserva chega uma vez?** Sim, e com UID estável. A deduplicação
  funciona.

E apanhou-se um erro nosso: os três bloqueios entraram como reservas
confirmadas, porque a regra em vigor era «veio de um feed, logo é reserva» —
escrita para o problema oposto, quando as reservas do Airbnb apareciam
cinzentas. Corrigido no mesmo dia: `eBloqueio` passa a ler o texto que o feed
manda, e um bloqueio importado mostra a frase do próprio feed.

### Como se sabe que a fase acabou bem

Um mês completo em que o calendário do Anfitrião nunca esteve errado, e a
resposta escrita à pergunta «quantas vezes mexi em preços este mês?».

---

## Fase 2 — A operação passa para cá 🔴 **bloqueada**

> **Precisa da API do Amenitiz (H3).** O feed iCal não diz quem chega, e sem
> isso não há check-in para enviar, não há pessoa para comunicar ao SIBA e não
> há nome nem valor para faturar. Ver «O muro por baixo do muro».
>
> A parte que **não** depende de hóspedes está separada na **Fase 2b**, abaixo,
> e essa pode arrancar já.

O Amenitiz continua a ser o gestor de canais. O Anfitrião passa a ser **onde
vives o dia a dia**. É aqui que está quase todo o valor da migração, e o risco
continua baixo porque nada disto toca na disponibilidade.

### O que passa, e de que depende cada coisa

- **`/hoje`** — entradas, saídas, quem está em casa. 🔴 Precisa de saber quem
  chega: hoje mostraria «Quarto indisponível».
- **Check-in online** — 🔴 não há email para onde mandar o link.
- **SIBA por web service** — 🔴 não há pessoa para comunicar. Continua a
  depender também de **H1** (registar cada alojamento no portal em modo «Web
  Service»: NIPC, estabelecimento e chave, 1–3 dias úteis, credenciais tuas e
  não da plataforma). ⚠️ **Validar contra `/bawsdev/`** (`SIBA_WS_URL`) antes
  do primeiro envio real — um boletim em falta são 100–2.000 € por hóspede.
- **Faturação certificada** — 🔴 não há nome, NIF nem valor. Depende também de
  **H2** (conta de parceiro InvoiceXpress) e de `INVOICEXPRESS_PARTNER_API_KEY`.
- **Hóspedes** — 🔴 fichas de quem o feed não nomeia.

Os quatro 🔴 desaparecem todos no dia em que a API do Amenitiz responder. **É
uma dependência só**, e é por isso que ela subiu ao topo da lista.

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

## Fase 2b — O que não depende de saber quem chega ✅ **pode arrancar já**

Tudo isto funciona com a informação que já cá está, e nada disto espera pela
API. É onde está o valor que sobra da Fase 2 enquanto ela estiver bloqueada.

- **Conformidade** (`/conformidade`) — RNAL, seguro, Livro de Reclamações,
  certificado energético, com aviso antes de expirarem. Não depende de reservas
  nenhumas.
- **Dossiê para inspeção** (`/conformidade/dossie/[id]`) — imprime o estado das
  obrigações e a prova de comunicação ao SIBA. Enquanto não houver
  comunicações, diz honestamente que não há.
- **Cartaz do Livro de Reclamações** — pronto a afixar.
- **Financeiro** (`/financeiro`) — despesas e lucro. A receita das reservas dos
  canais não vem no feed, portanto entra à mão ou fica de fora; as **despesas**
  são todas tuas e não dependem de ninguém.
- **Preços e regras** (`/precos`) — a sazonalidade fica escrita uma vez. Não se
  envia para lado nenhum (o iCal não leva preços), mas deixa de viver na tua
  cabeça — é a Fase B do `docs/SINCRONIZACAO.md`.
- **Site próprio e reservas diretas** — é a Fase 3, e essas reservas nascem cá,
  portanto trazem hóspede, email e valor. **As reservas diretas são, hoje, as
  únicas em que o Anfitrião tem a informação toda.**

Esta última linha é a mais importante do documento: enquanto a API não chegar,
**o caminho para o Anfitrião ter dados completos não é importar melhor — é
vender direto.**

---

## Fase 3 — Reservas diretas (a primeira em que escrevemos no mundo)

Aqui o Anfitrião deixa de ser só leitor. Uma reserva feita no teu site tem de
bloquear as plataformas — e o caminho é o feed que exportamos.

```
Anfitrião ──iCal──► Amenitiz ──API──► Airbnb / Booking / Vrbo
```

### Duas coisas a resolver **antes**, não durante

1. ~~**O feed de exportação não pode devolver ao Amenitiz o que veio dele.**~~
   **Feito a 2026-09-02.** Em `/canais`, o painel «Levar as tuas datas para as
   plataformas» pergunta agora **quem vai ler o endereço**:

   | Destino | Endereço | O que leva |
   |---|---|---|
   | Uma plataforma (Airbnb, Booking) | `/api/ical/<id>` | Tudo o que ocupa datas |
   | Um gestor de canais (Amenitiz) | `/api/ical/<id>?origem=diretas` | Só as reservas do teu site |

   **Ao Amenitiz dás o segundo.** As reservas que vieram dele já são dele;
   devolver-lhas punha um bloqueio nosso por cima de uma reserva dele, que
   depois ninguém sabe desfazer.

2. ~~**A frequência da sincronização.**~~ **Resolvido a 2026-09-02**, e não pela
   frequência: a disponibilidade passou a ser confirmada ao vivo no momento de
   aceitar a reserva (secção «Atualização online», acima). O cron diário deixou
   de estar no caminho crítico — continua a encher o calendário que vês, e o
   plano Vercel Pro só é preciso se quiseres esse ecrã ao minuto.

### Dois riscos conhecidos desta fase, por verificar

**1. O eco.** A tua reserva direta vai para o Amenitiz pelo feed. Se o Amenitiz
**reexportar** essa reserva no iCal do quarto — que é o feed que nós lemos —
ela volta cá com o UID dele, é tratada como reserva nova e ficas com ela em
duplicado. Muitos gestores de canais fazem exatamente isto.

Não está resolvido em código porque não sei se o Amenitiz o faz, e uma defesa
construída contra um comportamento imaginado costuma proteger do caso errado.
**É a primeira coisa a verificar quando ligares o feed de exportação**: cria uma
reserva direta, espera pela sincronização seguinte, e vê se ela aparece duas
vezes no calendário. Se aparecer, diz — a defesa é pequena (não importar um
evento cujas datas coincidem exatamente com uma reserva direta já existente na
mesma propriedade), mas só se escreve depois de se saber que é precisa.

**2. As leituras ao vivo e o IP partilhado.** Cada tentativa de reserva direta lê
os feeds das plataformas. Num site com movimento, isso são muitas leituras a
partir do **mesmo endereço de saída da Vercel**, partilhado por todos os
anfitriões. Se o Airbnb ou o Amenitiz limitarem esse IP, a verificação ao vivo
passa a falhar e — como fecha por omissão — as reservas diretas param.

Não está mitigado com cache de propósito. Com um alojamento e pouco tráfego não
acontece, e pôr uma cache no único sítio que tem de estar certo troca um risco
raro por um permanente: uma resposta guardada é uma resposta velha, e velha é
exatamente o que esta verificação existe para não ser. Se e quando houver
volume, a mitigação é uma cache curta (30–60 s) por feed — mede-se primeiro.

O sintoma, se acontecer, é visível: o alerta de canal dispara e as reservas
diretas são recusadas com «não foi possível confirmar a disponibilidade».

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

> ⚠️ **A 2026-09-03 este pedido deixou de ser só sobre a Fase 4.** Sabendo-se
> que o feed iCal não traz reservas, a mesma API é o que destranca a **Fase 2**
> — check-in, SIBA e faturação. Uma dependência, duas fases, e é a única coisa
> na lista toda que se resolve com um email escrito hoje.

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

_Reordenado a 2026-09-03: a API do Amenitiz subiu de segundo para primeiro
quando se percebeu que bloqueia a Fase 2 inteira, e não só a Fase 4._

1. 🔴 **API do Amenitiz (H3)** — Definições → API, no painel. **Bloqueia a Fase
   2 e a Fase 4.** Um email, hoje, e a resposta demora o que demorar. É a única
   coisa nesta lista em que o atraso não depende de ti.
2. **`RESEND_API_KEY`** — bloqueia a Fase 0 e o alerta de canal partido por
   email. Minutos.
3. **H1 · SIBA** — 1–3 dias úteis por alojamento. Vale a pena pedir em
   paralelo com a 1: quando a API chegar, isto já está tratado.
4. **H2 · InvoiceXpress** — bloqueia a faturação.
5. **Clerk de produção, Sentry, PITR** — bloqueiam a Fase 0.
6. **Vercel Pro** — confirmado **Hobby**, que é para uso não comercial. Não
   bloqueia nada enquanto fores o único utilizador; passa a ser pré-requisito
   **antes do primeiro cliente a pagar** (ver TODO 0.7). ~20 €/mês.

### O que fazer enquanto se espera pela 1

A Fase 2b (conformidade, dossiê, financeiro, preços) e a Fase 3 (site próprio)
não dependem dela. E vale a pena repetir a conclusão da 2b:

**As reservas diretas são, hoje, as únicas em que o Anfitrião tem a informação
toda** — hóspede, email, valor. Enquanto a API não chegar, o caminho para o
Anfitrião deixar de ser um espelho não é importar melhor: é vender direto.
