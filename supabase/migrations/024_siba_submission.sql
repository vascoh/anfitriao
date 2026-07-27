-- Tracking de submissão automática à AIMA/SIBA (ver lib/siba-api.ts).
-- O export CSV manual (lib/siba.ts) continua a funcionar sem depender disto;
-- estas colunas só registam o resultado da tentativa de submissão via API,
-- quando/se ativada (SIBA_API_URL configurado).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS siba_status text NOT NULL DEFAULT 'nao_submetido',
  ADD COLUMN IF NOT EXISTS siba_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS siba_reference text,
  ADD COLUMN IF NOT EXISTS siba_error text;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_siba_status_check
  CHECK (siba_status IN ('nao_submetido', 'a_processar', 'submetido', 'falhou'));

CREATE INDEX IF NOT EXISTS bookings_siba_status_idx ON public.bookings (siba_status)
  WHERE siba_status <> 'submetido';
