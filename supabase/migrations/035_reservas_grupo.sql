-- Reservas de grupo: alugar uma casa inteira de uma só vez.
--
-- Desde que uma casa com quartos deixou de contar como unidade alugável
-- (30/07), ficou correto para os números e errado para as pessoas: quem
-- quisesse levar um grupo para a casa toda tinha de criar uma reserva por
-- quarto, com o mesmo hóspede e as mesmas datas, tantas vezes quantos os
-- quartos — e entre a primeira e a última alguém podia ficar com um deles.
--
-- Um grupo é **N reservas ligadas**, uma por quarto, e não uma reserva na
-- casa-mãe. Uma reserva na casa-mãe seria mais fácil de criar e partiria tudo
-- o resto: a casa não é unidade alugável, logo a ocupação e o RevPAR
-- dividiriam por um denominador que não a inclui, o calendário de cada quarto
-- não a mostraria, e o feed iCal por quarto — que é como as plataformas leem a
-- disponibilidade — não a exportaria. Os quartos ficariam livres para toda a
-- gente menos para nós.
--
-- Assim, tudo o que já existe continua a funcionar sem saber que os grupos
-- existem.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reserva_grupo_id text;

COMMENT ON COLUMN public.bookings.reserva_grupo_id IS
  'Liga as reservas criadas em conjunto (casa inteira). NULL numa reserva normal. Ver lib/grupos.ts.';

-- A lista de reservas e o /hoje agrupam por isto, sempre dentro de um dono.
CREATE INDEX IF NOT EXISTS bookings_grupo_idx
  ON public.bookings (owner_id, reserva_grupo_id)
  WHERE reserva_grupo_id IS NOT NULL;
