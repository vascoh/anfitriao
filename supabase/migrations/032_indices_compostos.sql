-- Índices compostos (owner_id, data) — D2 do DOSSIE-ESTRATEGICO-2026-08.
--
-- Os índices existentes são de coluna única (`idx_bookings_owner`,
-- `idx_bookings_check_in`, …). Isso obriga o planeador a escolher entre
-- filtrar por dono ou por data e varrer o resto — e **toda** a leitura da
-- aplicação começa por `owner_id` e restringe logo a seguir por período.
--
-- Sem custo de escrita relevante nesta escala e o efeito cresce com os dados.

CREATE INDEX IF NOT EXISTS bookings_owner_check_in_idx
  ON public.bookings (owner_id, check_in);

CREATE INDEX IF NOT EXISTS bookings_owner_check_out_idx
  ON public.bookings (owner_id, check_out);

CREATE INDEX IF NOT EXISTS bookings_owner_estado_idx
  ON public.bookings (owner_id, estado);

CREATE INDEX IF NOT EXISTS expenses_owner_data_idx
  ON public.expenses (owner_id, data);

-- Boletins por entregar: o painel do SIBA lê sempre por dono e estado.
CREATE INDEX IF NOT EXISTS bookings_owner_siba_status_idx
  ON public.bookings (owner_id, siba_status);
