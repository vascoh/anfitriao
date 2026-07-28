-- Faturação certificada (ANF-4.10/4.11).
-- O documento legal vive no fornecedor certificado (InvoiceXpress/Vendus/
-- Moloni); aqui guarda-se apenas a referência, para saber o que já foi
-- faturado e não emitir duas vezes. Nunca replicar numeração, ATCUD ou hash.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fatura_estado text NOT NULL DEFAULT 'nao_emitida',
  ADD COLUMN IF NOT EXISTS fatura_id_externo text,
  ADD COLUMN IF NOT EXISTS fatura_numero text,
  ADD COLUMN IF NOT EXISTS fatura_atcud text,
  ADD COLUMN IF NOT EXISTS fatura_url text,
  ADD COLUMN IF NOT EXISTS fatura_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS fatura_emitida_em timestamptz,
  ADD COLUMN IF NOT EXISTS fatura_erro text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_fatura_estado_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_fatura_estado_check
  CHECK (fatura_estado IN ('nao_emitida', 'a_emitir', 'emitida', 'falhou'));

COMMENT ON COLUMN public.bookings.fatura_id_externo IS
  'Id do documento no fornecedor certificado. A fatura legal vive lá, não aqui.';
COMMENT ON COLUMN public.bookings.fatura_atcud IS
  'Código único de documento atribuído pelo fornecedor, guardado só para consulta.';

-- Evita emitir duas vezes o mesmo documento por corrida entre pedidos.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_fatura_id_externo_idx
  ON public.bookings (fatura_id_externo)
  WHERE fatura_id_externo IS NOT NULL;
