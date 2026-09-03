-- 044 · `estado` e `origem` das reservas passam a ser conjuntos fechados
--
-- Aplicada em produção a 2026-09-03.
--
-- Porquê
-- ------
-- `siba_status` e `fatura_estado` sempre tiveram CHECK; `estado` e `origem`
-- não. As rotas gravavam o que viesse no corpo do pedido — `/api/bookings` e
-- `/api/bookings/grupo` faziam `estado: body?.estado ?? 'confirmada'` sem
-- verificar o valor.
--
-- É o mesmo buraco que o painel de administração tapou para as contas, e o
-- comentário de lá descreve-o bem: «um valor fora do conjunto ficava lá
-- gravado e a app passava a comparar contra uma palavra que não existe».
--
-- Numa reserva sai mais caro do que numa conta:
--   * um estado desconhecido não é `cancelada` nem `no_show`, portanto a
--     reserva continua a ocupar datas e a contar na receita;
--   * `availableActions` devolve-lhe uma lista vazia e `canTransition` recusa
--     tudo — a reserva fica **presa para sempre**, sem transição possível;
--   * `STATUS_LABEL[estado]` fica indefinido e a etiqueta aparece vazia.
--
-- A validação na aplicação foi acrescentada nas duas rotas no mesmo
-- incremento. Isto é a garantia que não depende de a próxima rota se lembrar.
--
-- Verificado antes de aplicar: as linhas existentes conformam
-- (`estado='confirmada'`, `origem='outro'`).

alter table public.bookings
  add constraint bookings_estado_check
  check (estado in ('pendente','confirmada','checkin','checkout','cancelada','no_show'));

alter table public.bookings
  add constraint bookings_origem_check
  check (origem in ('airbnb','booking','direto','expedia','vrbo','outro'));
