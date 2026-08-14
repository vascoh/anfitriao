# Anfitrião — Progress Log

_Iniciado: 2026-06-06_

---

## Tarefas Concluídas

### [2026-08-14f] Pedido público de reserva — quem escolhia as chaves primárias era o browser

- 🔑 **Os ids vinham do cliente.** `validateBookingRequest` aceitava `guest.id` e `booking.id` se fossem UUIDs válidos. No caminho **pago** isso é grave: o `fulfillCheckoutSession` faz `upsert` do hóspede, portanto quem soubesse o id de uma ficha reescrevia-a com o nome e o email dele — e mudava-lhe o dono. E o id não é secreto: o `hospede_id` ia no payload do check-in, cujo link anda por email (a outra correção de hoje fechou a janela, mas os links já partilhados continuam a existir). Passam a ser gerados no servidor, sempre; quem precisa deles recebe-os na resposta, que já os devolvia.
- 👥 **Ninguém verificava a capacidade.** O caminho de grupo validava (`capacidadeTotal`), o caminho de uma propriedade não validava nada: aceitava um pedido de 50 pessoas para um T0. O número vai para `num_hospedes`, que é **quantos boletins o SIBA vai esperar** — um número inventado ali estraga a conformidade sem ninguém perceber porquê.
- 🧪 3 testes novos na suite da rota pública; verificados contra o código antigo: falham.
- ✅ 651 testes, typecheck 0, lint 0, build OK.

### [2026-08-14e] Crons — o lembrete de pagamento chegava quatro vezes, e a triplicar

- 📨 **Quatro emails, não um.** A janela apanha os check-ins dos **próximos 3 dias** e o guarda de repetição só olhava para "já enviei hoje". Resultado: o mesmo hóspede recebia o mesmo lembrete quatro dias seguidos — incluindo depois de já ter pago por transferência, enquanto o anfitrião não registasse o valor. Passa a ser uma vez por reserva, que é o que o comentário da rota sempre disse ser a intenção.
- 🏠 **E multiplicado pelos quartos.** Numa casa alugada por inteiro, cada quarto mandava o seu lembrete com o seu saldo parcial: três emails, três valores, nenhum deles o que a pessoa deve. Passa a um email com o total do grupo, com o nome da casa-mãe e "casa inteira (N quartos)" em vez do nome de um quarto ao acaso. Combinado com o de cima: de **12 emails** para **1**.
- 🐛 **Um erro meu, apanhado antes de sair**: o `select` da rota não trazia `reserva_grupo_id`, portanto o agrupamento que acabara de escrever não agrupava nada. Verificados também os outros crons — `automations` e `relatorio-mensal` usam `select('*')`, `faturacao` pede o campo explicitamente.
- ✅ **Verificado e correto** (fica dito, para não se repetir a busca): os 9 crons do `vercel.json` existem todos em código e nenhum ficou órfão; `compliance-alerts` avisa por marcos (30/15/7/0 dias e repetição periódica depois de expirar), não todos os dias; `relatorio-mensal` já conta unidades alugáveis e exclui canceladas; `certificado_energetico_validade` existe mesmo com esse nome — o nome truncado que eu tinha visto era artefacto do meu próprio dump, não uma coluna errada.
- 👤 **Fica por decidir**: um alojamento **sem** RNAL ou sem seguro registados nunca é avisado — os alertas são de expiração, e um item em falta não tem data para expirar. Alertar todos os dias seria spam; a periodicidade certa é decisão de produto.
- ✅ 648 testes, typecheck 0, lint 0, build OK.

### [2026-08-14d] Admin — suspender uma conta não suspendia nada

- 🚨 **A ação mais consequente do painel não fazia efeito.** O middleware lê `estado` do `publicMetadata` do Clerk (JWT) para não ir à base de dados em cada pedido. O webhook do Stripe sincroniza isso à mão a seguir a cada `updateAccount`; o painel de administração **não**. Resultado: suspender uma conta escrevia `suspenso` na base, mostrava-a suspensa no painel — e o utilizador continuava a entrar normalmente até um evento do Stripe passar por ali. O mesmo para mudanças de plano feitas à mão.
- 🔁 **A sincronização passou para dentro do `updateAccount`**, onde nenhum caminho lhe pode escapar, em vez de ficar à responsabilidade de quem chama. É idempotente: o webhook pode continuar a chamá-la também. Uma alteração que não mexe no acesso (uma nota interna) não chama o Clerk.
- 🧪 5 testes com o Clerk e a base simulados. Verificado com a correção fora: **3 falham**.
- 🛡️ **Validação no formulário de admin**: `estado` e `plano` iam para a base como texto livre e a coluna não tem restrição nenhuma — um valor fora do conjunto ficava gravado e a app passava a comparar contra uma palavra que nenhum ramo do código trata. `propriedades_max` vinha de um `Number()` que aceita `NaN`.
- ✅ **Verificado e correto** (fica dito): o guarda de admin está no layout **e** na server action, e o middleware deixa o admin passar — nenhuma das páginas depende só do layout para autorizar escritas.
- ✅ 648 testes (5 novos), typecheck 0, lint 0, build OK.

### [2026-08-14c] Reservas e propriedades — bloquear o calendário do vizinho custava uma conta grátis

- 🚫 **O bug mais explorável desta série.** `POST /api/bookings` verificava se a **reserva** era minha, mas nunca se o **alojamento** era. E o id de uma propriedade é público — está no URL de `/book/[id]` e nos links do site de cada anfitrião. Bastava uma conta grátis para criar reservas confirmadas no alojamento de outra pessoa: `hasConflict` procura **por propriedade, não por dono**, portanto o site do vizinho passava a responder "datas ocupadas" a todos os hóspedes. E ele não via nada: o calendário dele só mostra reservas com o `owner_id` dele. Um bloqueio invisível do negócio de outro, sem deixar rasto onde ele o procurasse. Também no fluxo pago: o `fulfillCheckoutSession` reverifica o conflito e **reembolsava** reservas legítimas já pagas.
- 🧍 **O mesmo para o `hospede_id`**: uma reserva não empresta acesso à ficha de quem é cliente de outro anfitrião.
- 🏠 **`parent_id` sem dono validado** — um alojamento podia declarar-se quarto da casa de outra pessoa. Como o feed iCal que ela exporta agrega os quartos (correção de 12/08), o intruso injetava datas ocupadas no calendário que ela publica nas plataformas. Corrigido na escrita **e** no export, que passa a filtrar quartos pelo dono da casa.
- 💳 **Limite de plano só corria ao criar.** Quem chegasse ao teto desativava um quarto, criava outro e reativava o primeiro — ficando com mais unidades do que o plano dá. A verificação passa a correr também nas alterações.
- 🧪 `lib/ownership.test.ts` (10 testes) — o guarda aceita o cliente como argumento, por isso testa-se sem base de dados. Inclui a diferença que interessa: `canUpsertRow` deixa passar um id que não existe (é uma linha nova), `ownsProperty` recusa (uma referência tem de apontar para alguma coisa real).
- ✅ 643 testes (12 novos), typecheck 0, lint 0, build OK.

### [2026-08-14b] Check-in — o link era uma janela permanente para o documento do hóspede

- 🪟 **O URL do check-in é o id da reserva, e é partilhado por email e WhatsApp.** Fica para sempre em caixas de correio, cópias reencaminhadas e telemóveis emprestados — e enquanto respondesse com a ficha completa, era uma janela **permanente** para o número do documento, a data de nascimento e a morada de quem lá dormiu. Meses depois da estadia, quem tivesse o link continuava a ler tudo. O próprio código já reconhecia o risco noutro sítio: o feed iCal público troca o id real por um hash *precisamente* para não dar acesso a esta rota.
- ⏱️ **A janela passa a fechar-se** (`lib/checkin-acesso.ts`) quando o link cumpriu o que tinha a fazer: check-in submetido, ou estadia terminada. Depois disso a reserva continua a responder (datas, alojamento, anfitrião) para a página se explicar — o que deixa de sair são as pessoas. É a mesma ideia da retenção: cumprido o fim, acaba o fundamento. O dia do check-out ainda conta, que é quando alguém pode estar a acabar de preencher.
- ✍️ **O mesmo do lado da escrita.** O POST não tinha janela nenhuma: com um link antigo dava para reescrever a ficha meses depois, apagar dados de um boletim já entregue e voltar a disparar o email de check-in ao anfitrião. Corrigir uma gralha antes de sair continua a ser possível.
- 🆔 **`property.owner_id` deixou de ir no payload** — identificador interno da conta, sem nada que fazer no browser de um hóspede.
- 💸 **`/api/documentos/extrair` estava aberto a toda a gente.** É uma rota pública que chama um modelo pago (tem de ser pública: é o hóspede que fotografa o documento). "Pública" não pode querer dizer "aberta": qualquer pessoa na internet podia gastar o orçamento de IA, e o limitador por IP é em memória — não funciona em serverless. Passa a exigir **uma de duas provas**: sessão de anfitrião, ou o id de uma reserva com o check-in aberto — um UUID que só quem recebeu o link tem.
- ✅ 631 testes (6 novos), typecheck 0, lint 0, build OK.

### [2026-08-14] Páginas públicas — a ficha completa do alojamento estava no código-fonte

O pior achado da série, e estava **live**.

- 🔓 **Tudo o que é prop de um componente `'use client'` vai serializado no HTML.** A página pública `/book/[id]` passava o objeto `Property` inteiro, vindo de um `select('*')`. Qualquer pessoa que abrisse o código-fonte lia: **credenciais do SIBA** (`siba_nipc`, `siba_estabelecimento`, `siba_chave_acesso`, contactos), **os endereços iCal privados** do Airbnb/Booking/Amenitiz — que dão o calendário de reservas completo a quem os tenha —, a **morada** (mesmo com `mostrar_morada_publica` a falso, que é a definição que existe para isso não acontecer), o RNAL, a apólice do seguro e o certificado energético.
- 🔍 **Confirmado em produção antes de corrigir**: `\"endereco\":\"Rua de Bijagós 13A\"` estava no HTML servido. Os campos do SIBA saíam vazios **só porque ainda não há credenciais configuradas** — no dia em que forem introduzidas (pendência H1), passavam a sair todas. A encriptação em repouso de 12/08 protegia a base de dados enquanto a página as publicava ao lado.
- 📋 **A casa inteira recebia `bookings`** — todas as reservas do anfitrião: datas, `hospede_id`, preços, `notas` (que no iCal trazem o nome de quem reservou), estado do boletim, referências de fatura e do Stripe. Para calcular disponibilidade bastam as datas ocupadas.
- ✅ **`lib/property-publica.ts` é uma lista de permitidos, não de proibidos**: um campo novo na tabela não passa a público por descuido, e há teste que o garante (`segredo_futuro` não sai). As definições do site também deixam de levar `owner_id`, email de reservas e assinatura.
- 🧱 **As funções puras de disponibilidade e preço passam a pedir só os campos que usam** (`QuartoParaGrupo`, `Ocupacao`, `{ id, preco_base, taxa_limpeza }`) em vez de `Property`/`Booking` inteiros — é o que evita que a linha completa volte a entrar no browser pela porta do lado, porque agora o tipo não deixa.
- ✅ 625 testes (10 novos), typecheck 0, lint 0, build OK. **Verificado em produção depois do deploy**: `siba_*`, `ical_feeds`, `rnal_numero`, `seguro_apolice`, `owner_id` e a morada dão todos **0 ocorrências**, e a página continua a mostrar a casa, os quartos e o bloco de casa inteira.

### [2026-08-12h] Concierge e automações — e um IDOR em seis rotas ao mesmo tempo

Comecei pelo concierge e pelas automações; o IDOR apareceu pelo caminho e é o mais grave do dia.

- 🔓 **IDOR sistémico: seis rotas faziam `upsert` com id vindo do cliente sem verificar o dono.** `tarifas`, `price_rules`, `platform_rates`, `automations`, `posts` e `expenses`. Qualquer anfitrião autenticado podia mandar o id de uma linha de outro e sobrepô-la — **ficando ainda com o `owner_id`**, o que faz o roubo parecer legítimo. Nas três tabelas penduradas numa propriedade dava também para escrever tarifas e comissões no alojamento de outra pessoa. O guarda (`canUpsertRow`) já existia, é usado em `/api/guests` e `/api/bookings`, e **a regra está escrita no CLAUDE.md** — faltava quem a verificasse. Acrescentado `ownsProperty` para o `property_id`.
- 🧪 **Teste estrutural novo** (`api/upserts-com-dono.test.ts`): varre as rotas e falha se alguma faz `upsert` sem guarda, com uma lista de exceções justificadas (check-in público, subscrição de push). Verificado com as correções fora: **falha**. É o que faltava para isto não voltar.
- 📧 **Um hóspede de casa inteira recebia a mesma mensagem três vezes.** O motor de automações é anterior aos grupos: três reservas do mesmo hóspede, nas mesmas datas, davam três "o teu check-in é amanhã" na mesma manhã. `envioPorGrupo` manda uma e regista as irmãs no `automation_log` — sem esse registo, a execução do dia seguinte achava-as por enviar e repetia à mesma.
- ✂️ **O concierge devolvia respostas truncadas com ar de completas.** O `finally` fechava o stream mesmo quando a API falhava a meio: o anfitrião ficava com meia frase, sem erro nenhum, pronta a copiar para o hóspede. Passa a `controller.error`, com o caso do hóspede fechar o separador tratado à parte.
- 💰 **Custo de IA atribuível**: o pedido passa a levar `signal` (fechar o separador deixa de pagar tokens até ao fim) e os tokens de entrada/saída ficam nos logs por conta. É o mínimo antes do teto por conta (ANF-11.1), que precisa de decisão.
- ✅ 615 testes (11 novos), typecheck 0, lint 0, build OK.

### [2026-08-12g] Stripe — o plano que não se reconhece virava Starter

- 💸 **O pior: `priceToPlano` tinha `return 'starter'` como fallback.** Uma subscrição cujo preço a app não reconheça — e o `STRIPE_EMPRESA_PRICE_ID` **não está definido em produção** — era classificada como Starter. Um cliente pagava 99 €/mês e ficava com o limite de 3 unidades, sem ninguém dar por isso. Passa a devolver `null`: o webhook mantém a conta activa (o pagamento é real) mas **não mexe no plano nem nos limites** quando não sabe, e regista `plano_por_identificar` no `audit_log` para haver olhos humanos.
- 🚪 **`customer.subscription.updated` mandava tudo o que não fosse `past_due` para "activo"** — incluindo `canceled`, `unpaid`, `incomplete_expired` e `incomplete`. Uma subscrição cancelada deixava a conta com acesso completo, e um checkout abandonado a meio da autenticação do cartão dava conta activa sem nunca ter havido pagamento. Mapa explícito em `estadoDaSubscricao`, com um estado novo do Stripe a suspender (reversível) em vez de abrir as portas.
- 🧍 **Uma reserva paga nascia sem hóspede identificado.** Todos os outros caminhos ligam quem reservou em `reserva_hospedes` — é de lá que sai um boletim por pessoa. O do pagamento não ligava ninguém: o SIBA respondia "reserva sem hóspedes" numa reserva que tinha nome, email e dinheiro pago.
- 🔇 **Um reembolso falhado era invisível.** Quando as datas ficam ocupadas entre o pagamento e a confirmação, reembolsa-se automaticamente — mas se o reembolso falhasse, ficava dinheiro cobrado sem reserva nenhuma e só um `console.error` a dizê-lo. Passa a ficar no `audit_log` nos dois casos, com sessão, `payment_intent` e valor.
- ⏳ **O aviso de fim do período experimental desaparecia no dia em que expirava** (`daysLeft >= 0`). Quem deixasse passar o prazo voltava a uma app sem sinal nenhum e sem caminho para escolher plano. O banner passa a ficar, com texto próprio.
- ✅ 604 testes (9 novos), typecheck 0, lint 0, build OK.
- 👤 **Duas decisões que são suas, não minhas** (deixo-as por fazer de propósito): (1) **um trial que expira não faz nada** — o `estado` continua `trial` para sempre e só o middleware bloqueia contas `suspenso`, ou seja o período experimental é ilimitado na prática; (2) **`invoice.payment_failed` suspende à primeira tentativa falhada**, quando o Stripe ainda vai tentar mais vezes ao longo de dias — um cartão que falha uma vez tranca o anfitrião a meio de uma estadia.

### [2026-08-12f] iCal — o sync só sabia somar, e havia dois syncs diferentes

Quatro bugs, todos na mesma família: o calendário local não seguia o das plataformas.

- 🔒 **Cancelamentos nunca chegavam.** Uma reserva cancelada no Airbnb desaparece do feed, e a reserva local ficava confirmada **para sempre**: quarto bloqueado no calendário, reservas diretas recusadas para datas livres, ocupação inflacionada. Passa a ser marcada como cancelada, com nota no histórico.
- 📅 **Alterações de datas também não.** O UID mantém-se, as datas mudam, e a reserva local ficava com as antigas — a receita para vender por cima de uma reserva que existe. Passam a ser aplicadas.
- 🧷 **Quatro travões, cada um uma forma conhecida de perder reservas** (`lib/ical-reconciliacao.ts`): não se toca no que não veio de feeds; não se cancela nada que já terminou (as plataformas deixam de publicar eventos antigos — sem isto o histórico inteiro caía na primeira execução); um feed que vem vazio quando ontem tinha reservas não cancela nada; e se **algum** feed da propriedade falhou, não se cancela nada nessa execução.
- 🔁 **Comparação pelo UID de origem, por propriedade, não por feed.** O `feed.id` muda quando se remove e volta a adicionar o mesmo calendário — o que os próprios guias da app mandam fazer quando o endereço muda — e a chave local era `${feed.id}::${uid}`: reimportava a agenda toda em duplicado e deixava as reservas antigas órfãs, nunca mais atualizadas.
- 🧨 **Havia dois syncs diferentes, e não se viam um ao outro.** O `/website` tinha uma segunda implementação **no cliente**: lia o feed pelo proxy, criava um **hóspede falso por evento** (com o texto da plataforma como nome) e guardava o UID dentro das `notas`. A rota do servidor deduplica por `uid_externo` — logo a mesma reserva entrava **duas vezes**, a ocupação passava dos 100 % e o calendário mostrava duas reservas nas mesmas datas. É o problema que a documentação atribui a ligar dois feeds, causado por dois caminhos nossos. O `/website` passa a chamar a rota do servidor.
- 🏠 **O feed exportado de uma casa com quartos saía vazio.** A app oferece URL de subscrição para **todas** as propriedades, mas a ocupação vive nos quartos desde 30/07. Quem colasse o endereço da casa no Amenitiz ou no Airbnb via-a livre todos os dias e vendia por cima de reservas reais. O export passa a agregar os quartos ativos: a casa está ocupada quando qualquer quarto seu está.
- ✅ 595 testes (14 novos), typecheck 0, lint 0, build OK. `docs/SINCRONIZACAO.md` descreve o comportamento novo.

### [2026-08-12e] Segunda ronda de caça a bugs — o Cartão de Cidadão ia como NIF na fatura

- 🧾 **O bug mais caro dos encontrados até agora.** `clienteDaReserva` punha `guests.numero_documento` no campo do NIF, e o adaptador manda-o para o `fiscal_id` da fatura **comunicada à AT**. O número do Cartão de Cidadão não é o NIF: um passaporte com letras seria recusado, e um CC de nove dígitos passava — ficando a fatura de um hóspede comunicada contra o **NIF de um desconhecido**. Nenhuma fatura real foi emitida (0 na base), por isso não há nada a corrigir junto da AT.
- 🧬 **O fixture escondia-o**: o hóspede de teste tinha `numero_documento: '123456789'`, que parece um NIF. Passou a ter um documento com letras (`12345678 9 ZZ4`) e um NIF à parte — a confusão deixa de caber no teste.
- ➕ **Migração 037**: `guests.nif`, opcional, pedido no check-in ("só se quiseres a fatura em teu nome") e editável na ficha do hóspede. Sem NIF a fatura sai a **Consumidor final**, que é o que a lei prevê. O NIF é dado fiscal (10 anos) e por isso não entra nos grupos anonimizáveis — ao contrário do número do documento, que cai ao fim de 1 ano.
- ⏳ **Retenção: o prazo dos acompanhantes contava-se da data da ficha, não da estadia.** `ultimasSaidas` só olhava para `bookings.hospede_id` — e um acompanhante nunca é quem reservou; está na reserva por `reserva_hospedes`. Desde que o boletim passou a ser por pessoa, **a maioria das pessoas de um grupo caía no fallback**, e a política escrita ("conta-se da última saída") deixou de descrever o código. Passa a olhar para os dois caminhos. Há teste para o caso que mais preocupa: ficha antiga com estadia futura já não é anonimizada.
- ✅ 581 testes (3 novos, escritos a falhar primeiro), typecheck 0, lint 0, build OK. Migração 037 aplicada em produção (aditiva, 0 linhas afetadas).

### [2026-08-12d] Caça a bugs nos grupos — dois reais, um deles com consequência legal

Revisão dirigida ao código mais recente e menos exercitado (grupos, boletins, faturação). Todos os bugs foram primeiro reproduzidos em teste, e só depois corrigidos.

- 🚨 **A mesma pessoa era declarada N vezes ao SIBA, e os acompanhantes nenhuma.** `/api/book/grupo` e `/api/bookings/grupo` ligavam quem reservou a **todos** os quartos do grupo em `reserva_hospedes` — a tabela de onde sai um boletim por pessoa. Um grupo de 3 pessoas em 3 quartos ficava com as três reservas dadas por **completas**: um boletim repetido três vezes e duas pessoas por comunicar (100 a 2.000 € de coima cada). Passa a ligar-se a **um** quarto; os restantes ocupantes entram no check-in, que é quando se sabem os nomes. O contacto continua em `bookings.hospede_id`, em todas as reservas.
- 🔁 **O mesmo bug tinha uma segunda porta**: a rede de segurança do check-in (`upsert` da ligação "para reservas anteriores à 036") voltava a ligar quem reservou a cada quarto onde fizesse check-in. Passa a não correr em reservas de grupo.
- 🧮 **E uma terceira consequência, no formulário**: o check-in do segundo quarto pedia menos uma ficha do que as pessoas que lá dormem, porque assumia que quem reservou era um dos ocupantes. A rota passa a dizer `principal_neste_quarto` e o formulário conta em conformidade.
- 💸 **Um quarto cancelado cancelava o grupo inteiro na lista.** `agruparReservas` tratava `cancelada` como "estado menos avançado", por isso um grupo com um quarto cancelado e dois confirmados aparecia como **Cancelada** — com o hóspede a chegar na mesma. E o valor mostrado (e o "em falta") incluía o quarto que já não se ocupa. As contas passam a fazer-se sobre as reservas vivas; um grupo inteiramente cancelado conta-se a si próprio. É a regra que a **faturação já usava** (`ativas` em `faturacao/emitir.ts`) — era a lista que discordava.
- 🔍 **Verificado e sem problema** (fica dito para não se repetir o trabalho): isolamento por dono em todas as rotas de API, incluindo `/api/faturacao/saft` e `/api/notification-preferences`; nenhuma aritmética de datas fora de `lib/utils`; a anonimização RGPD continua a limpar os campos agora encriptados.
- ✅ 578 testes (4 novos, todos escritos a falhar primeiro), typecheck 0, lint 0, build OK.

### [2026-08-12c] A calculadora que faz a conta pelo visitante, e os estados vazios que faltavam

Fecha o **2.4** (em parte) e o **2.5** do roadmap.

- 🧮 **`lib/comparador-precos.ts` + secção na landing**, antes dos preços: a tabela responde "quanto custa", a calculadora responde "quanto custa comparado com o que já pagas", que é a pergunta que a pessoa traz. Cursor de 1 a 40 unidades, preço atual por alojamento, alternador mensal/anual, e a diferença anual em destaque.
- 🚫 **Não se publicam preços da concorrência.** Mudam sem aviso, variam com módulos e descontos, e um número errado sobre outra empresa é uma alegação comparativa insustentável — a mesma razão que tirou o "+12 %" da landing a 02/08. O visitante escreve o que paga hoje: número que ele conhece e nós não.
- 🙂 **Quando não compensa, diz-se.** Com um alojamento só, pagar por conta sai mais caro, e a calculadora escreve isso em vez de arredondar a favor da casa. Uma ferramenta que dá sempre a mesma resposta é um cartaz, não uma calculadora — e quem faz a conta e vê o vendedor a ganhar em todos os cenários deixa de acreditar no resto da página. Há teste para o empate (19 € contra 19 € = não compensa).
- 🛑 **Acima de 40 unidades não inventa preço**: diz "falamos contigo". Empurrar o Empresa para uma cadeia seria vender o que não existe (não há RBAC nem portal de proprietário).
- 🎨 **A suite apanhou uma regressão de acessibilidade**: `contraste.test.ts` reprovou o `text-slate-500` que eu tinha usado (não chega a 4.5:1 sobre o fundo escuro). Corrigido para `text-slate-400`. O teste de contraste da landing existe desde julho e serviu exatamente para o que foi feito.
- 📭 **Estados vazios com ação** — os três que ainda eram becos sem saída: `/financeiro` ("sem despesas, o lucro em cima é só a receita"), `/automacoes` (as três receitas mais usadas, em vez de silêncio) e `/blog` (porquê escrever + botão para o primeiro post). Os grandes (`/reservas`, `/hospedes`, `/propriedades`) já estavam bem.
- ✅ 574 testes (10 novos), typecheck 0, lint 0, build OK.
- ⏭️ **Fica de fora, e é decisão sua**: a captura de email na calculadora. Guardar leads exige tabela nova, base legal e entrada no registo de tratamentos do art. 30.º — é uma decisão comercial com obrigações associadas, não uma linha de código.

### [2026-08-12b] Encriptação em repouso dos documentos + log de quem os leva daqui para fora

Fecha o **0.5 do roadmap** (ANF-1.7 e ANF-1.8). Feito agora por uma razão de oportunidade: com **0 hóspedes na base** não há backfill, não há paragem e não há hipótese de corromper dados de alguém. Daqui a três meses seria uma migração com risco.

- 🔐 **`lib/campos-sensiveis.ts`** — `numero_documento` e `data_validade_doc` passam a ser guardados em AES-256-GCM, reutilizando o `lib/crypto.ts` que já servia a chave SIBA. A coluna continua `text` e o criptograma é texto: **zero migrações**.
- 🎯 **Só estes dois campos, e está pensado**: é neles que está o dano de uma fuga — com nome e número de documento abre-se crédito e faz-se check-in noutro sítio. Nome, nacionalidade e data de nascimento ficam legíveis porque a app filtra e ordena por eles; encriptá-los dava a mesma proteção real (quem tem a base tem os nomes na mesma, pelas reservas) ao preço de partir metade do produto.
- 🚨 **Em produção sem chave, escrever falha.** Guardar um número de documento em claro porque a `APP_ENCRYPTION_KEY` não estava definida é exatamente o acidente que isto existe para evitar — e o silêncio é como se descobre tarde (ver o caso do `RESEND_API_KEY`). Em desenvolvimento guarda em claro com aviso, senão não havia check-in numa máquina local.
- 🔓 **A leitura é tolerante nos dois sentidos**: valores em claro (anteriores a esta mudança) passam intactos, e um valor adulterado devolve `null` com erro no log em vez de rebentar a página. Uma linha corrompida não pode derrubar a lista de hóspedes toda.
- 🧭 **Aplicado nas 9 fronteiras**, escrita e leitura: `/api/guests`, `/api/checkin` (quem reservou e cada acompanhante), `/api/reservas/[id]/hospedes`, `siba-fetch` (CSV + submissão), `faturacao/emitir` (o NIF da fatura é o número de documento — ia ciframento para dentro do documento fiscal), `db-admin.adminGetGuestById` e a exportação do art. 15.º, onde o titular tem direito aos dados "de forma inteligível", não ao criptograma.
- 📝 **ANF-1.8 — regista-se o que sai, não o que se vê**: CSV do SIBA descarregado, boletins entregues e ficheiro do art. 15.º ficam no `audit_log` com ação `acesso_dados_documento`, quem, quantas pessoas e o contexto. Ver a ficha de um hóspede na app **não** fica registado, de propósito: é o trabalho normal de quem gere alojamentos, e um log que cresce a cada página aberta deixa de se conseguir ler no dia em que for preciso.
- ✉️ **O email de check-in deixa de levar o número inteiro** — passa mascarado (`•••• 1234`). O email é um canal que não controlamos e fica arquivado para sempre na caixa do anfitrião; o número completo vê-se na app, que é onde tem de estar.
- 🏠 **`/financeiro`, o `!parent_id`** (pendente desde 30/07): o seletor de despesa mostrava só casas-mãe, mas as reservas vivem nos quartos — não havia onde imputar uma limpeza. Passa a listar a árvore toda (`ordenarComQuartos`), quarto indentado sob a casa, órfãos no fim em vez de desaparecerem. A eletricidade é da casa, a limpeza é do quarto.
- ✅ **564 testes** (16 novos), typecheck 0, lint 0, build OK. `docs/RGPD-REGISTO-TRATAMENTOS.md` atualizado: duas medidas do art. 32.º passam de ❌ a ✅.
- ⏭️ **Fica em aberto**: o `schema.sql` gerado da produção (a deriva `text` vs `UUID` continua por documentar) e o MFA no Clerk, que é configuração, não código.

### [2026-08-12] Deploy de tudo o que estava só no local — e o silêncio dos emails confirmado

O trabalho de 02–03/08 estava commitado mas **não pushado** (11 commits) e produção corria o build de 03/08 sem as variáveis que as funcionalidades novas exigem. Sessão de ponto de situação, sem código novo.

- 🔑 **`APP_ENCRYPTION_KEY` gerada e definida em produção** (`openssl rand -base64 32`, sensível no Vercel). Só em Production — preview/development ficam de fora para dados de teste não partilharem chave com dados reais. Desbloqueia o cofre da chave SIBA **e** a criação de contas de faturação, que até aqui eram recusadas em vez de guardarem credenciais em claro. Momento certo para a fixar: 0 propriedades com chave SIBA e 0 contas de faturação, portanto nada encriptado se perde. A partir do primeiro registo, perdê-la é perder as credenciais.
- ⬆️ **Push feito**: `origin/main` = `3180512`. Os 11 commits de 02–03/08 deixam de existir só nesta máquina.
- 🚀 **Deploy `dpl_BcyFYGDitJjJsi3CStaZ815nBfHX`** (`npx vercel deploy --prod`, 10:08) — produção passa do build de 03/08 para `3180512`. Probe: `/`, `/sign-up`, `/robots.txt`, `/sitemap.xml` a 200. 548 testes e typecheck 0 antes do deploy.
- 🔴 **Confirmado nos logs de arranque, e continua por resolver**: `RESEND_API_KEY` não está definida em produção — `[arranque][email] … NENHUM email é enviado (NoopProvider engole tudo)`. O diagnóstico de 30/07 está a fazer exatamente o que devia; falta a chave. Afeta pedidos e confirmações de reserva, check-in, lembretes de pagamento, fim de trial, alertas de conformidade, relatório mensal e as automações. Falta também `EMAIL_FROM` (sem ela sai de `onboarding@resend.dev`, que só entrega ao dono da conta).
- ⚠️ **Outras variáveis em falta em produção**: `INVOICEXPRESS_PARTNER_API_KEY` (a página de faturação diz que não está disponível) e `STRIPE_EMPRESA_PRICE_ID` (o plano Empresa existe no código e na página de preços, mas o checkout não tem price ID). Dependem de valores das contas Resend/InvoiceXpress/Stripe.
- 📊 **Base de dados em produção**: 1 conta, 4 propriedades, **0 reservas, 0 hóspedes, 0 faturas, 0 submissões SIBA**. O mês de uso real ainda não arrancou.

### [2026-08-03d] Uma casa inteira, uma fatura

- 🧾 Uma casa alugada por inteiro são N reservas na base (para o calendário, o iCal e a ocupação continuarem certos) mas **uma** reserva para quem pagou. Estava a gerar N faturas.
- 📄 O documento leva uma linha de alojamento **por quarto** (quem pagou 920 € quer ver de onde vieram, e o contabilista também), as limpezas somadas numa linha e a taxa turística noutra — que por natureza é por pessoa e por noite.
- 💣 **A regra que evita o erro caro**: as reservas partilham número, ATCUD e link, mas o `fatura_total` de cada uma guarda **a sua parte**. O total faturado é somado a partir das reservas — repetir 920 € em três linhas mostraria 2.760 € de receita que nunca existiu. O número é partilhado, o dinheiro é repartido.
- 🔀 `emitirFaturaDaReserva` deteta o grupo e reencaminha: o botão numa das linhas e o cron do checkout dão no mesmo sítio, não há forma de emitir três documentos por engano. O cron salta os grupos já tratados na mesma execução, senão a segunda e a terceira linha contavam como falhas num relatório onde nada falhou.
- ↩️ Uma fatura, uma nota de crédito: anula pelo valor todo e marca as N reservas.
- ✅ 548 testes (9 novos).

### [2026-08-03c] OCR em cada acompanhante, e o limite que o impedia

- 📸 O boletim passou a ser por pessoa, mas a leitura do documento só existia para quem reservava — num grupo de oito eram sete fichas preenchidas à mão, no telemóvel, que é onde qualquer pessoa desiste. Cada acompanhante passa a ter o mesmo botão, com a mesma rota.
- 🌍 O documento não diz onde a pessoa vive, por isso o país de residência **herda-se** de quem reservou (num grupo que viaja junto é o caso esmagadoramente comum) e continua editável.
- 🚧 O limite de `/api/documentos/extrair` era 5/hora por IP, pensado para um hóspede a fotografar um documento. Um grupo de oito faz oito leituras do mesmo telemóvel e da mesma rede: batia na parede à sexta pessoa, a meio do check-in, com uma mensagem sem sentido nenhum para quem está do outro lado. Passa a 20 — cobre um grupo grande com repetições e continua a limitar o custo de IA.
- ⚠️ Fica dito no código o que isto **não** resolve: o limitador é em memória e não funciona em serverless. O teto real só existe depois do Upstash (0.3 do roadmap).

### [2026-08-03b] Um boletim por pessoa, como a lei pede — e a casa inteira ponta-a-ponta

- ⚖️ **O bug com coima associada**: o boletim de alojamento é individual (Lei 23/2007), mas `bookings.hospede_id` era singular — uma reserva de 8 pessoas gerava **um** boletim e ficavam 7 por comunicar, a 100–2.000 € cada. Não era problema dos grupos: qualquer reserva de casal já comunicava metade das pessoas. Os grupos é que o tornaram impossível de adiar.
- 🧍 `bookings.hospede_id` continua a ser **quem reservou** (o contacto, quem recebe emails, quem aparece na lista); os acompanhantes vivem na tabela nova `reserva_hospedes`. Nada do que já existe muda de significado. A migração retoma o histórico, ligando o principal de cada reserva existente, para não haver dois caminhos no código.
- 🔢 `lib/hospedes-reserva.ts` distingue três coisas que se confundiam numa só: pessoas que a reserva diz ter, fichas criadas, e fichas completas. É a diferença entre "faltam 5 por identificar" e "a Maria não tem documento".
- 📤 `/api/siba-submit` gera um boletim por pessoa e **só marca a reserva como entregue quando todos forem aceites** — entregar 5 de 8 e dar por feito esconderia exatamente o que se quer evitar. Recusa-se a entregar quando faltam fichas, dizendo quantas.
- 🏠 **Grupos, dos dois lados**: `/api/bookings/grupo` (app) e `/api/book/grupo` (site público) criam N reservas ligadas por `reserva_grupo_id`, uma por quarto, **num só insert** — ou entram todas, ou não entra nenhuma; meio grupo alojado é pior do que grupo nenhum, porque só se descobre à chegada. Uma reserva na casa-mãe seria mais fácil e partiria tudo o resto: a casa não é unidade alugável, logo ocupação e RevPAR dividiriam por um denominador que não a inclui, o calendário de cada quarto não a mostraria, e o feed iCal por quarto não a exportaria — os quartos ficariam livres para toda a gente menos para nós.
- 💬 O site público responde **antes** de pedir seja o que for: se não cabem, diz quantos cabem; se um quarto está ocupado nessas datas, diz qual e manda reservar os livres. O preço mostrado no browser é só para ver — o servidor recalcula antes de aceitar. O anfitrião recebe **uma** notificação, não três, porque recebeu um pedido, não três. Sem pagamento, como o `/api/book`: o Stripe Connect ainda não está concluído.
- 💶 Um total fixado pelo anfitrião (desconto de casa inteira) reparte-se pelos quartos na proporção do preço de cada um, para o relatório por alojamento continuar a fazer sentido.
- 🔧 Correção do Vasco: os testes de grupos usavam a capacidade que estava na base (4) e não a real — Quarto Familiar leva 5, a casa leva 8. Documentavam um cenário errado ("8 pessoas não cabem"; cabem, à justa: 5 + 2 + 1).
- ✅ 526 → 539 testes.

### [2026-08-03] SIBA por web service + faturação certificada + plano Empresa

A sessão que fechou as duas maiores promessas por cumprir. Ambas **em produção e à espera de credenciais**, não de código.

- 📡 **SIBA a sério** — `lib/siba-api.ts` era um placeholder que devolvia 501 à espera de "documentação da AIMA". A premissa estava errada: o web service é público e documentado, e as credenciais são **do anfitrião, por estabelecimento**. Contrato confirmado ao vivo contra o WSDL de produção e cruzado com `rafaelrpinto/node-siba`. `siba-xml.ts` (MovimentoBAL, envelope SOAP, leitura da resposta e as normalizações onde isto falha na prática: tipo de documento, código de país, nome partido em dois campos, CP4/CP3, datas ao meio-dia UTC), `siba-mapping.ts` (**nunca adivinha** — nacionalidade desconhecida conta como campo em falta, porque um código errado é recusado na mesma e sem explicação útil), cliente com 3 tentativas e recuo exponencial (o serviço devolve HTML em vez de SOAP quando está em baixo; não repete quando o erro é dos dados, porque repetir daria o mesmo).
- 🔐 `lib/crypto.ts` (AES-256-GCM): sem `APP_ENCRYPTION_KEY` a app **recusa gravar**, em vez de guardar uma credencial do Estado em claro. `/api/properties` deixou de devolver a chave encriptada ao browser.
- 🧾 **I1 — a prova** (migração 030): `siba_submissoes` guarda o SHA-256 do que foi enviado e a resposta em bruto. Todos os concorrentes vendem a submissão; o que interessa numa fiscalização é a prova. Migração 031: `pais_residencia`/`local_residencia` em `guests` — sem país de residência nenhum boletim pode ser entregue, e a app não o recolhia; passa a ser pedido no check-in ao próprio hóspede.
- 💼 **Faturação: uma conta InvoiceXpress por anfitrião, criada com a nossa chave de parceiro.** A camada existia mas estava órfã, e a conta era única em variáveis de ambiente — errado em multi-tenant e errado na substância: a fatura tem de sair no NIF de quem presta o serviço. Uma conta única emitiria tudo em nome do Anfitrião e não serviria a contabilidade de cliente nenhum. O anfitrião **nunca vê o InvoiceXpress**: dá nome fiscal e NIF, autoriza a comunicação à AT uma vez, e as faturas aparecem sozinhas.
- ⏰ Cron `/api/cron/faturacao` às 07:00 emite o que fez checkout — é o que separa "podes faturar aqui" de "as tuas faturas estão feitas". Anulação sempre por nota de crédito, nunca por reemissão (a numeração já foi comunicada à AT). SAF-T do mês num botão (202 = ainda a gerar, não é erro). IVA 6/5/4 % por região, taxa turística isenta M99. Migração 033 (`faturacao_contas`). `docs/FATURACAO.md` descreve fluxo e limites.
- 🏢 **Plano Empresa** (99 €) e o limite de plano passa a contar quartos, não casas.
- 🗂️ **D2 — índices compostos `(owner_id, …)`** em `bookings` e `expenses` (migração 032): os de coluna única obrigavam o planeador a escolher entre filtrar por dono ou por data, e toda a leitura da app começa por `owner_id` e restringe logo a seguir por período.
- 🚫 **Taxa turística não expandida, de propósito**: a fonte primária cobre exatamente os 5 concelhos implementados e confirma que Lagos não cobra. Para os restantes só há blogues em desacordo entre si — um deles dava Cascais a 1 € quando são 4 € desde janeiro de 2025 (o código está certo). Um valor errado aqui cobra dinheiro a mais a hóspedes reais.
- 🔍 **Deriva de esquema encontrada ao executar**: `properties.id`, `bookings.id` e `guests.id` são `text` em produção, apesar de a migração 001 os declarar `UUID`. As migrações **não** são a fonte de verdade da base — quem escrever DDL a partir dos ficheiros falha, como falhou aqui à primeira. Vale um `schema.sql` gerado da produção.
- ✅ 345 → 470 testes.

### [2026-08-02] A landing deixa de prometer o que o produto não faz + dossiê estratégico

- 🚨 A landing v2 anunciava **caixa de entrada unificada** (com painel ilustrado a mostrar mensagens do Airbnb e do Booking) e **contrato eletrónico**. Nenhum dos dois existe: o Concierge gera texto para o anfitrião copiar, e não há assinatura de contrato. Dizia ainda "atualização contínua" para uma sincronização que corre 1×/dia.
- ✍️ Trocado pelo que existe mesmo — conformidade portuguesa, check-in online com leitura de documento, receita e despesas — e o painel ilustrado passa a mostrar o cartão de conformidade, com legenda a dizer que os dados são de exemplo.
- ⚖️ Sai o **"+12 % ocupação"**: sem cliente que o sustente é uma alegação não comprovável (Diretiva Omnibus), não um detalhe decorativo. O "14 dias" escrito à mão no hero e no CTA passa a vir de `TRIAL_DIAS`, para a copy não poder divergir do produto.
- ❓ FAQ nova sobre a frequência de sincronização: o iCal não é instantâneo em plataforma nenhuma, e por isso não se promete eliminar as duplas reservas.
- 📕 **`docs/DOSSIE-ESTRATEGICO-2026-08.md`** substitui a tese central do plano de julho: (1) a conformidade PT **não** é um fosso vazio — EazyAL e Hostkit já a entregam; (2) o SIBA tem web service público e as credenciais são do anfitrião, logo a "pendência AIMA" era falsa; (3) o que sobra de vantagem é **preço por conta, não por alojamento**.

### [2026-07-30] Sincronização: instruções na app + o plano para preços e restrições

Contexto novo: o Vasco tem o **Amenitiz** como gestor de canais ativo. Isso muda a topologia certa e destapou uma mina.

- 🧨 **O feed do Amenitiz seria recusado** — `amenitiz.com`/`amenitiz.io` não estavam na allowlist anti-SSRF. Mesma classe do `airbnb.pt`. Acrescentados, mais Smoobu, Lodgify e Beds24.
- 💬 **A mensagem de recusa passa a nomear o domínio**: "O domínio «x» não está na lista de plataformas suportadas". Antes era um beco sem saída ("URL não permitido") que não distinguia http, domínio em falta ou URL partido. Agora um domínio novo é um pedido de 30 segundos em vez de uma investigação.
- 📖 **Instruções dentro do formulário**, não num manual à parte: `lib/ical-guias.ts` tem os passos de menu de cada plataforma (verificados contra a documentação pública), o exemplo do endereço e as notas. Há teste a garantir que os exemplos que ensinamos **passam na allowlist** — um guia que ensina um URL recusado é pior do que nenhum.
- ⚠️ **Aviso de duplicação** (`deveAvisarDuplicacao`): quem já tem gestor de canais ligado e tenta acrescentar o Airbnb recebe aviso. A mesma reserva chegaria por dois caminhos com UID diferentes, a deduplicação não a apanharia e a ocupação passaria dos 100 %. Com o Amenitiz é **um feed por quarto, dele e só dele**.
- 📄 **`docs/SINCRONIZACAO.md`** — a resposta ao "botão para sincronizar o resto": **não pode existir por iCal**. O formato só transporta datas ocupadas, como a própria documentação do Amenitiz confirma. Proposta em três fases (observador → consultor → gestor), sendo a fase intermédia uma **fila de "por aplicar"** que usa o modelo que já existe (`price_rules`, `tarifas`, `platform_rates`) e é o mesmo que um `ChannelAdapter` enviaria — quando a API do Amenitiz estiver ligada, a fila drena sozinha em vez de à mão. Nada se deita fora.
- 👤 **Pendência humana barata e com prazo longo**: pedir acesso à API no painel do Amenitiz (Definições → API). Sem isso não há fase 3, e a resposta demora o que demorar.
- ✅ 345 testes (11 novos), typecheck 0, lint 0, build OK.

### [2026-07-30] Limpeza para o mês real + a casa deixa de contar como unidade

- 🧹 **Produção limpa**: apagadas as 2 reservas de teste (`52accf4f`, `27ad9ffb`) e os 2 hóspedes órfãos (Vasco Henriques, Tia zezinha). Fica **0 reservas, 0 hóspedes, 4 propriedades**. Cópia em `.backups/dump-antes-limpeza-2026-07-30.json` (fora do git).
- 🛑 **A "Casa de Vasco" NÃO foi apagada** — o pedido inicial era apagá-la, mas a estrutura já era a descrita: `parent_id` dos 3 quartos aponta para ela. É onde vivem a morada real (Rua de Bijagós 13A, Amora) e as comodidades da casa; os quartos têm morada vazia. Com `ON DELETE SET NULL`, apagá-la deixaria 3 alojamentos órfãos sem morada e faria o site público voltar a listar 3 cards independentes — o bug corrigido a 13/07.
- 🎯 **Decisão do utilizador**: a casa não se aluga inteira, só os quartos. Implementado como **regra derivada, não campo novo**: `unidadesReservaveis()` em `lib/reservations.ts` — um alojamento com quartos ativos é o contentor deles, não uma unidade.
- 🐛 **Bug real que isto corrigiu**, e que teria estragado os números do mês: a ocupação e o RevPAR contavam a casa-mãe como unidade alugável. Com 3 quartos e 1 casa, o denominador era 4 unidades × dias em vez de 3 — **ocupação e RevPAR subavaliados em ~25%**, e a Casa de Vasco aparecia todos os dias na lista de "livres" do `/hoje`. Corrigido em 6 sítios: `relatorio-mensal.ts` (email mensal), `/hoje` (ocupação e vagas), `/relatorios` (ocupação por mês, RevPAR, ocupação por alojamento) e o seletor do `/reservas/nova`, que deixava criar reservas na casa inteira.
- 🧭 Derivado da estrutura em vez de um campo próprio para não haver estado que contradiga a realidade quando se acrescenta ou remove um quarto — e porque o site público **já** se comportava assim (`/book/[id]` de uma casa com quartos mostra a lista de quartos, nunca um formulário). A app interna é que discordava.
- ✅ 334 testes (5 novos), typecheck 0, lint 0, build OK.
- ⚠️ **Não mexido, a confirmar**: `/financeiro` filtra `!x.parent_id`, ou seja mostra só as casas-mãe no seletor de propriedade. Como as reservas vivem nos quartos, filtrar por "Casa de Vasco" não devolve nada. Não é o mesmo problema e pode ser intencional (agregar por casa) — mas com o mês real vai dar de caras com isto.

### [2026-07-30] RGPD a sério — retenção por código, acesso e apagamento (Fase 2.16)

Fecha ANF-1.10, ANF-1.11 e ANF-1.12. Até aqui a retenção era uma frase na política de privacidade; passa a ser uma rotina que corre todos os dias.

- 🗓️ **Prazos com base legal, num sítio só** — `lib/retencao.ts`: boletim de alojamento **1 ano** após a saída (Lei 23/2007 art. 16.º — recolhido para comunicar às autoridades; cumprido o fim, acaba o fundamento), nome e contactos **3 anos** após a última estadia (interesse legítimo, art. 6.º n.º 1 al. f), dados fiscais **10 anos** e intocáveis (art. 52.º do CIVA).
- 🧹 **Anonimiza, não apaga.** A reserva é um registo fiscal: apagar o hóspede partiria a cadeia. Anonimizar cumpre o art. 17.º na parte que nos compete — dados anonimizados deixam de ser dados pessoais (cons. 26) — e deixa de pé receita, ocupação e noites. O art. 17.º n.º 3 al. b ressalva precisamente o que a lei obriga a conservar.
- ⏱️ **O prazo conta-se da última saída, não da criação do registo**: quem volta reinicia a contagem, uma reserva por cumprir não inicia nada, e canceladas/no-shows não contam (não houve estadia). É a diferença entre uma política defensável e uma que apaga dados de um hóspede que está prestes a chegar.
- 🤖 Cron `/api/cron/retencao` diário às **03:00**, antes do `ical-sync` — é a única rotina que apaga, e não convém competir com as que escrevem. **Não notifica ninguém de propósito**: cumprir a política é o comportamento normal, não um evento. Cada anonimização fica no `audit_log` com autor, grupos e motivo.
- 📤 **Acesso e portabilidade (art. 15.º e 20.º)** — `GET /api/guests/[id]/dados` devolve ficha e reservas em JSON, como ficheiro para o anfitrião reencaminhar. Exportar só a ficha omitiria metade do que se trata sobre a pessoa.
- 🗑️ **Apagamento a pedido (art. 17.º)** — `DELETE` na mesma rota, e botão na ficha do hóspede com confirmação. Quem responde ao titular é o anfitrião (é ele o responsável pelo tratamento; nós somos subcontratante), por isso as rotas exigem sessão dele e só atuam sobre hóspedes da sua conta — não há aqui nada público.
- 📋 **Registo de atividades de tratamento** (art. 30.º) em `docs/RGPD-REGISTO-TRATAMENTOS.md`, derivado do esquema real e não de um modelo genérico: 7 tratamentos, fundamento de cada um, subcontratantes verdadeiros e uma tabela de medidas do art. 32.º que assume o que **não** está feito (RLS por JWT, encriptação em repouso dos campos de documento, log de acesso, MFA).
- 🔗 **A política de privacidade passa a ler os prazos de `lib/retencao.ts`** — mesma decisão que levou os preços para `lib/planos.ts`: a promessa pública e o comportamento real não podem divergir. Fecha 2 dos 10 campos `[POR PREENCHER]`.
- 🗃️ Migração **029** aplicada em produção (aditiva): `anonimizado_em`, `anonimizado_grupos`, `retencao_completa` + índice parcial. O `retencao_completa` existe para o SQL não ter de saber quantos grupos tem a política — quem decide é a app.
- ✅ **327 testes** (22 novos), verificados também em `TZ=Pacific/Kiritimati` e `Pacific/Midway`; typecheck 0, lint 0, build OK.
- 🔍 **Verificado antes de ligar**: os 2 hóspedes em produção têm check-out futuro (31/07 e 05/08), por isso a rotina é hoje um no-op. Com o serviço a existir desde maio de 2026, nada pode atingir o prazo de 1 ano antes de meados de 2027 — há tempo de sobra para rever os prazos antes de apagarem seja o que for.
- ⏭️ **Fica por fazer da mesma família**: encriptação em repouso dos campos de documento (ANF-1.7) e log de acesso a dados sensíveis (ANF-1.8) — ambos maiores e independentes.
- 👤 **Pendência humana**: prazo de conservação dos dados da conta após cancelamento e do `audit_log`. São os únicos números desta matéria que não consegui derivar da lei nem do código — dependem de decisão comercial.

### [2026-07-30] Verificação dos crons da Vercel — e o que ela desenterrou

A sessão de 28/07 deixou por confirmar se os 7 crons corriam, na suposição de que o plano Hobby limitava a 2. **A suposição estava errada e a preocupação era infundada** — mas a verificação encontrou outra coisa, pior.

- ✅ **Os 7 crons estão registados e ativos**: `vercel crons ls` devolve os 7 com `"enabled": true`, `undeployed: []`, `modified: []`.
- 📖 **O limite de 2 crons no Hobby já não existe** (docs de 2026-06-16): são **100 crons por projeto em todos os planos**. O Hobby restringe apenas a *frequência* (no máximo 1×/dia; expressões mais frequentes **falham o deploy**) e a *precisão* (±59 min). Os nossos 7 são diários, semanal e mensal — todos válidos. O deploy ter passado já era, em si, prova de que nenhum schedule violava o plano.
- ✅ **Invocação verificada ao vivo**, não deduzida: `vercel crons run /api/ical-sync` → `GET /api/ical-sync 200` nos logs de runtime. Escolhido por ser o único cron sem efeitos colaterais (todas as propriedades têm `ical_feeds` vazio). Confirma o caminho completo, incluindo o `CRON_SECRET`, que está presente em produção.
- ℹ️ Os logs de runtime não servem para auditar crons neste projeto: a retenção é de ~1h, por isso às 15h já não há vestígio das execuções das 04:00–10:00. Para confirmar execuções passadas, usar o separador Cron Jobs do dashboard ou deixar rasto na BD.

- 🔴 **Encontrado ao verificar: nenhum email sai de produção.** `RESEND_API_KEY` **não está definida** em produção (`vercel env ls production`: só 23 variáveis, nenhuma de email — nem `EMAIL_FROM`, nem `NOTIFY_FROM`). Em `lib/email/providers/index.ts`, sem a chave o serviço instancia `NoopProvider` — engole tudo em silêncio, sem erro. Alcance: **os 6 crons que enviam email** (compliance-alerts, noites-orfas, payment-reminders, trial-reminders, relatorio-mensal, automations), o `notify-booking`, o `notify-checkin` e o `notify-confirmation`. Ou seja: **o motor de automações, cuja única ação é "email ao hóspede", é um no-op em produção desde que existe.** O push não é afetado (VAPID configurado) — mas só 2 crons enviam push. Já constava como pendente humano desde 19/07 ("`EMAIL_FROM` no Vercel com domínio verificado no Resend"); o que é novo é a dimensão: não é um detalhe de remetente, é a funcionalidade inteira em silêncio.
- 🔔 **Aviso de arranque para o silêncio do email** (a seguir à descoberta acima). `diagnosticarEmail()` em `lib/email/config.ts` — função pura sobre o `env` — e `src/instrumentation.ts` a lê no `register()`, que corre uma vez por arranque de servidor. Deliberadamente **no arranque e não no primeiro envio**: um cron sem nada para enviar nunca chega a instanciar o provider, e era isso que fazia o silêncio parecer normalidade. Distingue produção de preview por `VERCEL_ENV` (o `NODE_ENV` diz "production" em ambos) e apanha dois casos, não um: sem `RESEND_API_KEY` (nada sai) e com chave mas sem `EMAIL_FROM` (sai de `onboarding@resend.dev`, o domínio de testes do Resend, que só entrega ao dono da conta — falha igualmente silenciosa e que ainda por cima parece funcionar). Em desenvolvimento e CI é um aviso, não um erro.
- 🧾 **`NoopProvider` deixa rasto de cada email descartado** (assunto + destinatário mascarado, `j***@exemplo.com`). Os logs de runtime da Vercel não são sítio para endereços de hóspedes; o domínio chega para perceber o que se perdeu.
- ✅ **305 testes** (9 novos em `lib/email/config.test.ts`), typecheck 0, lint 0, build OK. Os três cenários verificados com o servidor a correr, não só em teste unitário: sem chave → erro; com chave e sem `EMAIL_FROM` → erro do sandbox; bem configurado → silêncio.
- 🚀 **Deployado** (`dpl_3LssrTbM12Me8VeScP4rDjDnCnYe`) e **confirmado a disparar em produção**: o aviso aparece nos logs de runtime, marcado como `error` (é `console.error`), em cada arranque a frio de uma lambda Node. As páginas estáticas não o mostram — não arrancam servidor; a proxy corre em edge e sai do `register()` logo à entrada. Aparece à primeira rota dinâmica ou de API, que é onde importa. Push dos 3 commits pendentes feito no mesmo passo.
- 🟡 **`compliance-alerts` nunca avisa sobre itens em falta.** `deveAlertar()` devolve `false` quando `diasParaExpirar` é `undefined`, que é o caso de tudo o que está `em_falta`. Coerente (não há data futura a partir da qual contar marcos), mas a consequência é que um RNAL ou um seguro **que nunca foram preenchidos** não geram alerta nenhum — só aparecem em `/conformidade` se o anfitrião lá for. As 4 propriedades em produção estão exatamente nesse estado (todos os campos a `null`), pelo que este cron hoje não notifica nada. A decidir: alerta semanal para `em_falta`, ou aceitar que o cofre é passivo.

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

### [2026-07-29] Acessibilidade da landing v2 — auditoria axe-core

A landing nova nunca tinha sido auditada, apesar de existir um commit anterior sobre contraste WCAG AA nas páginas públicas e de o `axe-core` estar nas devDependencies (sem harness a usá-lo). Auditadas `/`, `/termos`, `/privacidade` e `/cookies`, em desktop e mobile, com as regras wcag2a/wcag2aa/wcag21a/wcag21aa. **14 violações → 0.**

- 🎨 **`text-slate-500` sobre `slate-900`/`slate-950`** dava 3.7–4.2:1, abaixo do mínimo de 4.5:1. Afetava a barra do mockup de painel, as etiquetas de canal, o estado das propriedades, a data das páginas legais e o rodapé. Todas passaram a `text-slate-400`.
- 🔗 **Links em corpo de texto sublinhados sempre**, não só no hover: dentro de um parágrafo, distingui-los apenas pela cor falha o WCAG 1.4.1 (não-dependência da cor). Corrigido em `pagina-legal.tsx`.
- 🧪 **`landing-v2/contraste.test.ts`** — guarda de regressão sem dependências novas: falha se as classes de cinzento demasiado escuro voltarem aos componentes da landing ou das páginas legais. Verificado que falha mesmo (introduzida uma violação de propósito, o teste apanhou-a e nomeou o ficheiro).

**Limitação assumida:** o guarda é textual, não sabe calcular contraste nem lê cores em CSS arbitrário (`text-[#...]`). Não substitui o axe. O Playwright não é dependência do projeto e não o acrescentei só para isto — a auditoria a sério continua a ser um passo manual antes de deploys com mudanças visuais.

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
- ~~⚠️ **A confirmar**: o `vercel.json` passou de 4 para **7 cron jobs**. O plano Hobby da Vercel limita a 2 crons (1×/dia)~~ — **verificado a 2026-07-30 e sem fundamento**: o limite é de 100 crons por projeto em todos os planos; o Hobby só restringe a frequência (≤1×/dia) e a precisão (±59 min). Os 7 estão registados, ativos e a responder 200. Ver entrada de 2026-07-30.
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
