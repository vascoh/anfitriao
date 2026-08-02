# Faturação certificada

_2026-08-03. Fornecedor: InvoiceXpress. Custo incluído na subscrição do Anfitrião._

---

## A decisão que estrutura tudo: uma conta por anfitrião

Em Portugal a fatura tem de ser emitida **pelo NIF de quem presta o serviço**.
Uma conta única da plataforma emitiria tudo em nome do Anfitrião: não serviria
a contabilidade de nenhum cliente, misturaria a receita de duas empresas e não
resistiria a uma inspeção.

Por isso:

```
Anfitrião (chave de parceiro)
     │
     ├── cria ──► conta InvoiceXpress do anfitrião A  (NIF A, série A, AT de A)
     ├── cria ──► conta InvoiceXpress do anfitrião B  (NIF B, série B, AT de B)
     └── ...
```

O anfitrião **nunca vê o InvoiceXpress**. Dá o nome fiscal e o NIF, autoriza a
comunicação à AT uma vez, e a partir daí as faturas aparecem sozinhas. É a
diferença face ao Amenitiz, que expõe a configuração da ferramenta de faturação
ao utilizador e o obriga a percebê-la.

---

## Como funciona, passo a passo

### 1. Criar a conta — `POST /api/faturacao/conta`

Dois campos: nome ou designação social e NIF. Por trás:
`POST /api/accounts/create.json` com a chave de parceiro. A resposta traz o
subdomínio e a chave da nova conta, que é **encriptada** (AES-256-GCM,
`lib/crypto.ts`) antes de ser guardada em `faturacao_contas`.

É idempotente: se já existir conta, devolve-a. Criar duas contas para o mesmo
NIF partiria a numeração em duas séries paralelas — um dos poucos erros de
faturação sem volta atrás.

### 2. Autorizar a AT — `PUT /api/faturacao/conta`

O único passo que o anfitrião tem mesmo de dar, porque só ele o pode fazer:
criar um **subutilizador** no Portal das Finanças (Gestão de Utilizadores) com
a permissão **WFA — Comunicação de dados de faturas**, e dar-nos `NIF/1` + a
senha desse subutilizador.

Essas credenciais vão diretamente para o InvoiceXpress
(`POST /api/v3/accounts/at_communication.json`, `communication_type: "auto"`) e
**não ficam guardadas no Anfitrião**.

No mesmo pedido cria-se a série (`POST /sequences.json`). As duas coisas andam
juntas de propósito: o InvoiceXpress só regista séries depois de ter
credenciais da AT, e uma conta com AT ligada mas sem série continua sem
conseguir emitir. Separá-las era garantir que metade dos anfitriões ficava a
meio do caminho.

### 3. Emitir

- **Sozinho:** cron diário `/api/cron/faturacao` às 07:00 percorre as contas com
  `emissao_automatica` e emite as faturas das reservas que já fizeram checkout.
- **À mão:** botão na lista, `POST /api/faturas`.

Nos dois casos passa por `lib/faturacao/emitir.ts`, para a regra "uma reserva,
uma fatura" valer igual. A proteção contra emissão dupla é uma transição de
estado condicionada (`fatura_estado` só passa a `a_emitir` se ainda estiver no
valor lido), o que faz com que o botão e o cron em simultâneo só deixem passar
um.

### 4. Anular — `DELETE /api/faturas`

Nota de crédito com as mesmas linhas da fatura original. Não se apaga nem se
reemite: a fatura já tem numeração comunicada à AT e o único caminho legal para
trás é um documento que a anule.

### 5. SAF-T — `GET /api/faturacao/saft?ano&mes`

O ficheiro que o contabilista pede todos os meses, num botão. É gerado de forma
assíncrona do lado do fornecedor (202 = "estou a gerar"), por isso o cliente
volta a pedir até vir o URL.

---

## O que é faturado, e com que taxas

Decidido em `lib/faturacao/mapping.ts` e `iva.ts`:

| Linha | Taxa | Base |
|---|---|---|
| Alojamento | 6 % continente · 5 % Madeira · 4 % Açores | Taxa reduzida sobre dormidas |
| Taxa de limpeza | igual à do alojamento | Tratada como parte do serviço quando não é autónoma — ⚠️ não é pacífico entre contabilistas |
| Taxa municipal turística | 0 %, isenção **M99** | Não sujeita a IVA (art. 2.º n.º 2 do CIVA) |

Os preços no Anfitrião são **com IVA incluído** (é o que o hóspede paga), por
isso convertem-se para base tributável antes de emitir. Misturar a taxa
turística com o alojamento inflacionaria o IVA liquidado.

---

## Configuração

| Variável | Para quê |
|---|---|
| `INVOICEXPRESS_PARTNER_API_KEY` | Criar contas de anfitriões. Sem ela a página diz que a faturação não está disponível. |
| `APP_ENCRYPTION_KEY` | Encriptar a chave de cada conta. Sem ela a criação de conta é **recusada** — guardar a chave em claro seria pior do que não guardar. |

---

## Limites conhecidos

- **Um NIF por conta de anfitrião.** Quem explore alojamentos por entidades
  fiscais diferentes precisa de mais do que uma conta — não está suportado.
- **Nota de crédito é sempre total.** Uma anulação parcial obriga a decidir o
  que se devolve, e isso é uma decisão de negócio, não um valor que se adivinhe
  a partir de um cancelamento.
- **Faturas de comissões das plataformas** (o que a Hostkit faz) ainda não
  existem: o Anfitrião só sabe estimar a comissão, não recebe o documento.
- **Séries anuais** não rodam automaticamente no dia 1 de janeiro.
