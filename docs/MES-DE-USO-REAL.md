# Mês de uso real — Casa de Vasco

_Preparado a 2026-07-30. Objetivo: pôr o Anfitrião a gerir um alojamento a sério
durante um mês, para o produto deixar de ser construído às cegas._

O critério de sucesso **não** é "correu tudo bem". É **ter uma lista escrita de
coisas que falharam ou irritaram**. Um mês sem essa lista foi um mês perdido —
significa que não se usou a sério.

---

## Antes de começar

### 1. Emails (bloqueia quase tudo) — ~20 min

Sem isto não sai uma única confirmação de reserva, lembrete ou alerta. É o
maior buraco atual.

1. Criar conta em [resend.com](https://resend.com).
2. Adicionar o domínio `anfitrioes.pt` e criar os registos DNS que o Resend
   indicar (SPF e DKIM), no painel onde o domínio está registado.
3. Esperar pela verificação (minutos a horas).
4. No Vercel → Settings → Environment Variables (Production):
   - `RESEND_API_KEY` = a chave `re_...`
   - `EMAIL_FROM` = `noreply@anfitrioes.pt`
5. Redeploy (`npx vercel deploy --prod`).

**Como confirmar:** os logs de runtime deixam de mostrar
`[arranque][email] RESEND_API_KEY não está definida`. Enquanto essa linha
aparecer, nada foi enviado — ela é a prova, não a ausência de erros.

### 2. Sincronização de calendários — ~15 min

O núcleo do produto. **Nunca correu com dados reais**: as 4 propriedades têm
`ical_feeds` vazio.

**Com o Amenitiz ligado, importa-se dele e só dele** — já agrega o Airbnb e o
Booking. Ligar também as OTA diretamente duplica cada reserva.

1. Amenitiz → **Channel Manager → iCals**. Copiar o endereço de **cada quarto**
   (são 3: Individual, Casal, Familiar — a Casa de Vasco não leva nenhum).
2. Colar em Propriedades → *(cada quarto)* → Editar → Calendários externos,
   com a fonte **"Amenitiz ou outro gestor de canais"**.
3. Carregar em sincronizar à mão e confirmar que aparecem reservas.

Os passos de cada plataforma estão agora dentro da app, no próprio formulário
("Onde encontro este endereço?"). Se um endereço for recusado, a mensagem diz
**qual é o domínio** — basta pedires para ser acrescentado.

⚠️ **O iCal só transporta datas ocupadas.** Preços, estadia mínima e restrições
de chegada continuam a definir-se no Amenitiz — não é limitação da app, é do
formato. O plano para os trazer para cá está em `docs/SINCRONIZACAO.md`.

⚠️ **Limite conhecido:** a sincronização automática corre **1×/dia** (às 04:00).
É o máximo do plano Hobby da Vercel, que restringe crons a uma execução diária.
Na prática, a janela de dupla reserva é de 24 horas. Se durante o mês isso
morder, é o argumento mais forte para o Vercel Pro — e passa a ser uma decisão
com dados, não uma suposição.

### 3. Decidir o que fazer aos dados de teste

Estão em produção duas reservas que **não são reais** — resíduo dos testes E2E:

| Reserva | Alojamento | Datas | Hóspede |
|---|---|---|---|
| `52accf4f` | Quarto Individual | 27–31/07 | Vasco Henriques |
| `27ad9ffb` | Quarto Individual | 01–05/08 | Tia zezinha |

Ambas `pendente`, `direto`, 200 €. Vão poluir receita, ocupação e ADR do mês.
**Apagar antes de começar** (decisão do Vasco — é apagamento de dados de
produção, não avanço sem ordem).

### 4. Pagamentos — só se quiseres testar reservas diretas com cobrança

O Stripe está configurado, mas **não consegui confirmar daqui se está em modo
de teste ou real** (as chaves estão marcadas como sensíveis no Vercel). Ver no
painel do Stripe antes de aceitar dinheiro verdadeiro. É preciso também
completar o *onboarding* do Stripe Connect na conta.

---

## A tratar antes de haver um segundo utilizador

Não bloqueiam o teu mês — bloqueiam o convite a outra pessoa.

- **O Clerk está em instância de desenvolvimento.** A chave em produção é
  `pk_test_...`, na instância `settled-weasel-80.clerk.accounts.dev`. Para ti
  funciona; para clientes reais não serve — as instâncias de desenvolvimento
  têm limites de utilizadores, credenciais OAuth partilhadas (o ecrã de
  consentimento da Google mostraria `clerk.accounts.dev`) e não são para
  produção segundo o próprio Clerk. Migrar para uma instância de produção
  implica refazer o *JWT template* — por isso convém fazê-lo **antes** de ligar
  o RLS (ANF-1.4), não depois.
- **Isolamento entre inquilinos** assente em `.eq('owner_id')` à mão em ~20
  rotas, sem RLS ligado. Com um só utilizador não fere ninguém; com dois, é o
  maior risco do projeto.
- **Páginas legais** com 10 campos por preencher e sem revisão jurídica.

---

## Durante o mês

### Todos os dias, 30 segundos
Abrir `/hoje` no telemóvel. É a única página que interessa. **Se tiveres de ir
a outro lado para saber o que fazer hoje, isso é um achado — escreve-o.**

A partir de hoje, `/hoje` também avisa quando um calendário está sem
sincronizar há mais de 48h ou deu erro. Antes isso só se via entrando na
página de edição da propriedade — ou seja, nunca.

### Todas as semanas, 10 minutos
- Fazer uma coisa "a sério" que ainda nunca fizeste na app: emitir uma fatura,
  submeter um boletim, responder com o Concierge, registar uma despesa.
- Ir ao `/financeiro` e ao `/relatorios` e perguntar: **acredito nestes
  números?** Se hesitares, escreve porquê.
- Confirmar que os emails chegaram mesmo à caixa do hóspede (não à pasta de
  spam).

### O caderno
Um ficheiro só, em `docs/DIARIO-MES-REAL.md`, com uma linha por atrito:

```
2026-08-03 — tive de abrir 3 ecrãs para saber quanto o hóspede ainda devia
2026-08-05 — o email de confirmação foi para spam no Gmail
2026-08-07 — quis marcar "limpeza feita" e não existe
```

Sem categorizar, sem priorizar, sem resolver na altura. Só registar. **A
tentação de corrigir a meio do mês é o que estraga a experiência** — corrige-se
tudo no fim, com a lista inteira à frente, e aí vê-se o que era importante e o
que era mania.

---

## No fim do mês

1. Ler a lista de atrito de uma assentada.
2. Contar quantas vezes o produto **te poupou** tempo e quantas te **custou**.
3. Comparar a lista com a Fase 3 do `PLANO-ESTRATEGICO-2026.md`. A pergunta a
   responder é dura: **quantas das funcionalidades planeadas aparecem no
   caderno?** As que não aparecerem são candidatas a nunca serem construídas.
4. Só então decidir a fase seguinte.

---

## Nota sobre o que este mês não resolve

Continuas a ser o único utilizador, e és o autor — sabes onde carregar e
perdoas o que outro não perdoaria. Este mês encontra bugs, atrito e
funcionalidades a mais; **não** valida preço, posicionamento nem se alguém paga
por isto. Isso exige um anfitrião que não sejas tu. O passo lógico a seguir é
um segundo alojamento, de alguém conhecido — e é para esse dia que a lista
"antes de haver um segundo utilizador" existe.
