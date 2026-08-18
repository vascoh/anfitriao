-- 040 — Quando é que a emissão foi reservada.
--
-- `fatura_estado = 'a_emitir'` é uma reserva feita antes de falar com o
-- fornecedor certificado, para que o botão e o cron não emitam dois documentos.
-- Funciona — mas nada a libertava: se o processo morresse entre reservar e
-- guardar o resultado (fim do tempo da função, deploy a meio, uma escrita
-- recusada), a reserva ficava em 'a_emitir' **para sempre**. O botão passava a
-- responder 409, o cron saltava-a por a confundir com uma corrida normal, e a
-- página mostrava uma roda a girar que nunca mais parava. A fatura podia
-- existir no fornecedor ou não existir, e ninguém sabia qual das duas.
--
-- Com a hora da reserva, uma emissão parada deixa de ser indistinguível de uma
-- emissão a decorrer — que é a única coisa que faltava para se poder agir.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fatura_reservada_em timestamp with time zone;

COMMENT ON COLUMN public.bookings.fatura_reservada_em IS
  'Início da emissão em curso. Uma reserva antiga com fatura_estado = a_emitir está presa: ver lib/faturacao/emitir.ts.';
