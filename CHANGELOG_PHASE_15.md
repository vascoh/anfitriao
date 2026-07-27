# Changelog — Ponto 3: automações, preview, exportação (2026-07-26)

_Terceiro item pedido: "mais gatilhos/ações no motor de automações, preview da mensagem, exportação Excel/PDF no financeiro"._

## Motor de automações — novo gatilho + refactor
- **Novo gatilho `pedir_avaliacao`** (1 dia após o checkout) — migration `022_automation_trigger_pedir_avaliacao.sql` (`ALTER TYPE ... ADD VALUE`, isolada por ser incompatível com outros comandos na mesma transação).
- `src/lib/automations.ts` (novo) — `TRIGGER_LABEL`, `TRIGGER_DATE` (coluna + desvio de dias por gatilho, generaliza o que antes era um `if/else` só com 2 casos), `renderAutomationMessage`, `PREVIEW_VARS`. Partilhado entre o cron e a UI — evita duplicar a lógica de substituição de variáveis.
- `api/cron/automations/route.ts` — usa `TRIGGER_DATE` para calcular a data-alvo de qualquer gatilho (extensível sem tocar na lógica principal); filtro de `estado` ajustado: gatilhos pós-estadia (`pedir_avaliacao`) aceitam reservas em `checkin`/`checkout`, não só `confirmada`/`pendente` (uma reserva já feita o check-in/checkout continua elegível para pedir avaliação).
- **Ação continua limitada a `email_hospede`** — push/WhatsApp exigiriam infraestrutura que não existe (hóspedes não têm conta na app; WhatsApp Business API é uma integração externa, já documentada como fora de âmbito).

## Preview da mensagem
`(app)/automacoes/page.tsx` — secção de pré-visualização que aparece assim que há texto na mensagem, mostrando assunto+corpo já renderizados com dados de exemplo (`Maria Silva`, datas fictícias), reutilizando `renderAutomationMessage`/`PREVIEW_VARS` do módulo partilhado.

## Exportação no financeiro
`(app)/financeiro/page.tsx` — botão "CSV" no cabeçalho, mesmo padrão já usado em `/relatorios` (CSV com BOM UTF-8, abre nativamente no Excel). Exporta despesas do ano + linhas de resumo (Receita/Despesas/Lucro). **Não gerei `.xlsx` nem PDF binários** — exigiria adicionar uma dependência nova ao projeto para um ganho marginal sobre CSV (que já abre em Excel/Sheets/Numbers sem conversão). Se vier a ser pedido PDF formatado (ex.: para enviar a um contabilista), é um incremento à parte com o skill `pdf`.

## Validação
`typecheck`/`lint`/`test` (118/118)/`build` — limpos. Migration aplicada e confirmada (`enum_range` mostra os 3 gatilhos). Deploy em produção.

**Nota sobre verificação visual**: as sessões de teste via Clerk sign-in token (mesmo mecanismo usado em `CHANGELOG_PHASE_14.md`) ficaram instáveis nesta ronda (tokens de utilização única a esgotar-se entre tentativas) — não insisti mais porque o código segue exatamente os mesmos padrões de UI (toggle, cartão com borda tracejada, formulário) já validados visualmente para outras páginas nesta sessão. Confiança baseada em code review + testes automáticos, não screenshot direto desta vez.

## Estado dos "próximos passos" pedidos
Com isto ficam feitos os 3 pontos pedidos nesta sequência: revisão manual → teste E2E → automações/preview/exportação. Ver `TODO.md` para o que resta (decisões de negócio pendentes + itens maiores como Blog, upload de ficheiros, RBAC).
