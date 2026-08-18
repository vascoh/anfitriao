# Guião da primeira reserva real

_Escrito a 2026-08-18. Tempo: **20 minutos** para o essencial, mais 1–3 dias úteis de espera se quiseres incluir o SIBA._

Todo o código deste produto nunca correu com um hóspede verdadeiro. 832 testes
provam que faz o que **eu** penso que faz; não provam que faz o que **um
hóspede** precisa. Este guião existe para atravessar essa fronteira uma vez, em
condições controladas, antes de a atravessar com alguém que pagou.

**Regra que atravessa tudo:** dados de teste levam `TESTE-E2E` no nome, e
apagam-se no fim. Está na secção 8.

---

## 0. Antes de começar (5 min, e sem isto não vale a pena)

### 0.1 Ligar o email — **é o único passo mesmo bloqueante**

Sem `RESEND_API_KEY`, **nenhum email sai**: o hóspede não recebe confirmação
nem link de check-in, e tu não és avisado de nada. O `NoopProvider` engole tudo
e não dá erro — o produto parece funcionar e não funciona.

1. [resend.com/api-keys](https://resend.com/api-keys) → *Create API Key* (chega
   permissão *Sending access*). Começa por `re_`.
2. Confirmar que `anfitrioes.pt` está **verificado** em
   [resend.com/domains](https://resend.com/domains). Os registos DNS já existem
   (DKIM, SPF do subdomínio `send.`, DMARC) — falta confirmar que o painel os dá
   como válidos.
3. Definir no Vercel, em **Production**:
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=noreply@anfitrioes.pt
   ```
4. Fazer deploy: `npx vercel deploy --prod` (as variáveis só entram no build
   seguinte).

### 0.2 Verificar que ficou de pé

Abrir **`/admin/saude`**. O bloco "Envio de email" tem de estar verde. Se
estiver vermelho, diz o que falta e não vale a pena continuar.

### 0.3 O que podes deixar para depois

| Serviço | Sem ele acontece o quê | Bloqueia este guião? |
|---|---|---|
| **SIBA** (credenciais do portal) | Não se comunica o boletim | Só a secção 6 |
| **InvoiceXpress** (chave de parceiro) | Não se emitem faturas | Só a secção 7 |
| **Stripe Connect** | Sem pagamento com cartão; o hóspede **pede** reserva e tu confirmas | Só a variante 3B |

---

## 1. Deixar o site apresentável (5 min)

Ir a **`/website`**. À direita está a pré-visualização do site verdadeiro; à
esquerda, a lista do que falta.

O site está publicado com o nome de fábrica — **"Reservas Diretas"**. Corrigir
pelo menos:

- **Nome do alojamento** — o teu, não o de fábrica.
- **Contacto** — email ou telefone.
- **Uma foto** em pelo menos um alojamento ativo (`/propriedades`).

> Se despublicares e voltares a publicar, a app passa a **exigir** estes três.
> Enquanto o site estiver no ar, podes guardar como está — a regra só aperta na
> passagem para publicado, para não te trancar fora das tuas definições.

Guardar. A pré-visualização recarrega sozinha.

**Verificar:** abrir `anfitrioes.pt/r/<o-teu-slug>` num separador anónimo. Se
carrega e mostra o alojamento com foto, esta parte está feita.

---

## 2. Fazer a reserva como hóspede (3 min)

Usar **o telemóvel**, não o computador — é por lá que os hóspedes chegam, e é
o ecrã que menos foi visto.

1. Abrir `anfitrioes.pt/r/<slug>` no telemóvel.
2. Escolher um alojamento → **Reservar**.
3. Datas: daqui a 2–3 dias (para os avisos automáticos entrarem no âmbito).
4. Nome: **`TESTE-E2E Maria Silva`**. Email: um teu, real, a que tenhas acesso.
5. Enviar.

**Verificar, por esta ordem:**

- [ ] A página de confirmação abre e mostra a reserva.
- [ ] Chega email **ao hóspede** ("Recebemos o teu pedido").
- [ ] Chega email **ao anfitrião** ("Nova reserva pendente").
- [ ] A reserva aparece em `/reservas` com estado **Pendente**.

**Se algum email não chegar:** ver `/admin/saude` primeiro, depois os *runtime
logs* na Vercel. A linha `[arranque][email]` diz se o provider está ligado.

---

## 3. Confirmar e cobrar

### 3A — Com pagamento por cartão (se tiveres o Stripe Connect ligado)

Antes: `/conta/pagamentos` → ligar a conta Stripe. Depois, na reserva feita em
2, o hóspede vê **Pagar agora** em vez de *Pedir reserva*.

- [ ] O pagamento conclui e volta à página de confirmação.
- [ ] A reserva nasce já **Confirmada**, com `preco_pago` igual ao total.
- [ ] Só existe **uma** reserva (o webhook e a página de confirmação correm os
      dois — de propósito; a duplicação está travada, mas vale a pena olhar).

### 3B — Sem pagamento (o caminho normal hoje)

Em `/reservas/<id>` → **Confirmar reserva**.

- [ ] O estado passa a **Confirmada**.
- [ ] Chega ao hóspede o email de confirmação, **com o link de check-in**.

---

## 4. Check-in online, no telemóvel do hóspede (4 min)

Abrir o link do email **no telemóvel**. É o ecrã mais importante do produto: é
onde um hóspede real desiste.

- [ ] Fotografar um documento (podes usar o teu). A leitura preenche os campos.
- [ ] Preencher o que faltar. **País de residência é obrigatório** — sem ele
      nenhum boletim pode ser entregue.
- [ ] Se a reserva for para 2+ pessoas, aparece uma ficha por pessoa. Preencher
      todas.
- [ ] Submeter.

**Verificar:**

- [ ] Chega-te o email "Check-in online concluído". O número do documento vem
      **mascarado** — é de propósito: o email fica arquivado numa caixa que não
      controlamos.
- [ ] Em `/reservas/<id>`, o cartão dos boletins diz **"prontos"**, não "faltam
      X".
- [ ] Reabrir o mesmo link: mostra "check-in já submetido" e **já não devolve
      dados pessoais** — a janela fecha-se depois de cumprida.

---

## 5. Verificar o que o hóspede não vê (2 min)

- [ ] `/hoje` — a reserva aparece nas chegadas.
- [ ] `/calendario` — as datas estão ocupadas no quarto certo.
- [ ] `/financeiro` — a receita aparece.
- [ ] `/hospedes` — a ficha existe, com o documento.

---

## 6. SIBA

### Sem credenciais de web service — o caminho de hoje

Enquanto o web service não estiver ligado, a comunicação faz-se à mão e continua
a valer legalmente:

- [ ] Em `/documentos`, escolher o período e **Exportar CSV**.
- [ ] Carregar o ficheiro no portal SIBA.
- [ ] De volta à app, carregar em **"Já carreguei no portal — marcar como
      comunicados"**.

O último passo não é cosmético: sem ele as reservas ficam eternamente por
comunicar, o `/hoje` acusa boletins fora do prazo que já foram entregues, e um
alerta que mente todos os dias deixa de ser lido. A marcação guarda o resumo
(SHA-256) do ficheiro entregue — a prova é o conteúdo, não o carregar do botão.

### Com credenciais — envio automático

**Como as obter** (1–3 dias úteis, começa por aqui se quiseres incluir):

1. Na área reservada do portal SIBA, registar o alojamento e escolher o modo de
   envio **Web Service**.
2. Recebes por email o **número de estabelecimento** e a **chave de acesso**.
3. Introduzir em `/conformidade`, junto com o NIPC.

**Antes do primeiro envio real**, apontar ao ambiente de testes: definir
`SIBA_WS_URL` para o endereço `/bawsdev/` e fazer uma submissão. Só depois
tirar a variável.

- [ ] Em `/documentos` ou `/conformidade`, submeter o boletim da reserva.
- [ ] Estado passa a **submetido**.
- [ ] Confirmar que ficou **prova**: a submissão guarda o SHA-256 do que foi
      enviado e a resposta em bruto. É o que interessa numa fiscalização.

> Se faltar alguma ficha, a app **recusa entregar** e diz quantas faltam — é
> deliberado: entregar 5 de 8 e dar a reserva por comunicada esconderia
> exatamente o que a coima pune (100 a 10.000 € **por boletim**).

---

## 7. Faturação — só com a conta de parceiro

1. Abrir conta de parceiro InvoiceXpress e definir
   `INVOICEXPRESS_PARTNER_API_KEY` em Production.
2. Em `/faturacao`: dar nome fiscal e NIF, autorizar a comunicação à AT.
3. Emitir a fatura da reserva de teste.

- [ ] A fatura sai com número e ATCUD.
- [ ] Sai no **teu NIF**, não no nosso.
- [ ] ⚠️ **Uma fatura emitida é comunicada à AT e não se apaga.** Se for de
      teste, anular por **nota de crédito** — é o único caminho legal para trás.

Se preferires não emitir documentos fiscais de teste — decisão razoável —
salta esta secção e testa a faturação no primeiro hóspede verdadeiro.

---

## 8. Limpar (2 min)

Só depois de tudo verificado:

1. `/reservas/<id>` → eliminar a reserva `TESTE-E2E`.
2. `/hospedes` → eliminar a ficha `TESTE-E2E Maria Silva`.
3. Se emitiste fatura: **não apagar** — a nota de crédito da secção 7 é o
   registo correto.

Confirmar em `/admin/saude` que não ficaram boletins em atraso nem faturas em
erro.

---

## O que estás mesmo a testar

Não é se o código corre — isso os 832 testes já dizem. É se **a sequência faz
sentido para quem está do outro lado**: se o email chega e se percebe, se o
check-in no telemóvel é rápido, se sabes o que fazer a seguir sem ler nada.

Se alguma coisa te obrigar a parar e pensar, isso é o achado — mais valioso do
que qualquer erro que apareça.

## Quando alguma coisa falha

| Onde | O que ver |
|---|---|
| **Primeiro** | `/admin/saude` — configuração e operação dos últimos dias |
| Emails | *Runtime logs* na Vercel, linha `[arranque][email]` |
| Reembolsos e acessos a dados | Tabela `audit_log` |
| SIBA | Tabela `siba_submissoes` (resposta em bruto do Estado) |
| Sincronização | `/website` → cada feed mostra erro e última sincronização |
