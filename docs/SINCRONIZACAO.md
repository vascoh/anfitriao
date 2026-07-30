# Sincronização com as plataformas

_2026-07-30. Contexto: o Vasco tem o **Amenitiz** como gestor de canais ativo._

---

## 1. O que está ligado hoje: calendário

O Anfitrião importa calendários por iCal. Instruções por plataforma dentro da
app (Propriedades → Editar → Calendários externos), derivadas de
`src/lib/ical-guias.ts`.

### Com o Amenitiz, a topologia certa é uma só

```
Airbnb ─┐
Booking ─┼──► Amenitiz ──iCal──► Anfitrião   ✅
Vrbo ───┘
```

**Um feed por quarto, vindo do Amenitiz. Mais nada.** O Amenitiz já agrega as
plataformas todas; ligar também o Airbnb diretamente traz a mesma reserva por
dois caminhos, com identificadores diferentes — a deduplicação por UID não a
apanha, fica duplicada no calendário e a ocupação passa dos 100 %. A app avisa
quando se tenta fazer isso (`deveAvisarDuplicacao`).

O Amenitiz dá **um endereço por quarto**, não um pela casa. São 3 feeds: Quarto
Individual, Quarto de Casal, Quarto Familiar. A Casa de Vasco não leva nenhum.

---

## 2. O muro: o iCal não transporta preços nem restrições

Não é uma limitação desta aplicação nem do Amenitiz. **O formato iCal só
transporta datas ocupadas.** A própria documentação do Amenitiz diz o mesmo:
os links iCal sincronizam disponibilidade e não transmitem preços,
restrições de entrada/saída nem estadias mínimas ou máximas.

Portanto **não existe, nem pode existir, um botão que sincronize preços por
iCal**. Quem o promete está a mentir ou a usar outra coisa por baixo.

Para preços e restrições há três caminhos reais, e só três:

| Caminho | O que exige | Realista quando |
|---|---|---|
| **API do Amenitiz** | Conta com acesso à API (pedido no painel: Definições → API), escalão Pro/Enterprise | Semanas. É o mais curto. |
| **Booking Connectivity Partner** | Candidatura + certificação da Booking | 3–6 meses |
| **API do Airbnb** | Parceria formal, difícil de obter | Incerto |

---

## 3. A proposta: modo observador → modo gestor

Em vez de fingir uma sincronização que o formato não permite, faseia-se a
tomada de controlo. Cada fase é útil sozinha e nenhuma se deita fora.

### Fase A — Observador _(é onde estamos)_
O Amenitiz manda. O Anfitrião lê o calendário e é onde vives o dia a dia:
`/hoje`, check-in online, boletim SIBA, conformidade, financeiro. Zero risco:
se o Anfitrião falhar, o negócio não pára.

### Fase B — Consultor _(a próxima, e a mais interessante)_

O Anfitrião passa a ser **onde se decide** o preço e as restrições, mesmo sem
os conseguir enviar. Já tem o modelo todo para isso — `price_rules` (preço por
período e dia da semana, estadia mínima e máxima), `tarifas` (políticas de
cancelamento), `platform_rates` (multiplicador por plataforma). O que falta é
a última milha.

**O que se constrói: uma fila de "por aplicar".**

Defines as regras aqui; o Anfitrião gera a lista concreta do que mudar no
Amenitiz, por quarto e por intervalo de datas:

```
Amenitiz · Quarto Familiar · 1–15 ago
  Preço          100 € → 125 €      (regra "Época alta")
  Estadia mínima   1 → 3 noites
  Chegadas       sem chegadas ao domingo
  [ marcar como aplicado ]
```

Carregas em *aplicar*, vais ao Amenitiz, mudas, e fica registado **quando** foi
aplicado. Se depois mexeres na regra, a linha volta a "por aplicar" — porque a
data da regra passou a ser mais recente que a da aplicação. É deteção de
divergência a sério, com o que temos.

Porque é que isto vale a pena mesmo sem API:

- **Resolve o problema verdadeiro**, que não é carregar no botão — é *saber o
  que mudar e não te esqueceres de o fazer*. Hoje isso vive na tua cabeça.
- **A sazonalidade fica escrita uma vez** e a fila repete-a todos os anos, em
  vez de a redescobrires em cada agosto.
- **É o mesmo modelo de dados que um `ChannelAdapter` enviaria.** No dia em que
  a API do Amenitiz estiver ligada, a fila deixa de ser uma lista para copiar e
  passa a drenar sozinha. **Nada do que se construir agora se deita fora** — só
  muda quem executa a fila: tu ou o adaptador.

### Fase C — Gestor
Ligado o adaptador (Amenitiz primeiro, OTA depois), o Anfitrião passa a
escrever. Aí sim, o botão que pediste — e nessa altura ele faz mesmo o que diz.

---

## 4. Recomendação

1. **Agora:** ligar os 3 feeds do Amenitiz e viver o mês (`docs/MES-DE-USO-REAL.md`).
2. **Em paralelo, hoje, e custa um email:** pedir acesso à API no painel do
   Amenitiz (Definições → API). É o passo mais barato com maior efeito — sem
   ele, a Fase C não existe, e a resposta demora o que demora. Pede já, decide
   depois.
3. **A seguir ao mês:** construir a Fase B, com a lista de atrito à frente. Se
   o mês mostrar que mexes em preços duas vezes por ano, a fila é exagero e
   fica-se pelo observador. Se mostrar que mexes todas as semanas, é a
   funcionalidade mais valiosa do produto — e nenhuma das duas conclusões se
   pode tirar antes do mês.

**Fontes:** [Amenitiz — connect with an OTA through iCal](https://support.amenitiz.com/en/articles/332620-how-to-connect-with-an-ota-through-ical) ·
[Amenitiz Channel Manager](https://amenitiz.com/en/product/channel-manager) ·
[Amenitiz developer portal](https://developers.amenitiz.com/)
