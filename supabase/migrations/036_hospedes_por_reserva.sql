-- Vários hóspedes por reserva (ANF-4.9, a sério).
--
-- O boletim de alojamento é **por pessoa**: a Lei 23/2007 art. 198.º obriga a
-- comunicar cada hóspede estrangeiro, não cada reserva. A base guardava um
-- `bookings.hospede_id` singular — logo uma reserva de 8 pessoas gerava um
-- boletim e ficavam 7 por comunicar, a 100–2.000 € de coima cada.
--
-- Não é um problema dos grupos: qualquer reserva de casal já estava a
-- comunicar metade. Os grupos é que o tornaram impossível de adiar.
--
-- Desenho: `bookings.hospede_id` continua a ser **quem reservou** — o contacto,
-- quem recebe os emails, quem aparece na lista. Os acompanhantes vivem nesta
-- tabela de ligação. Assim nada do que já existe muda de significado, e o que
-- passa a existir é só o que faltava.

CREATE TABLE IF NOT EXISTS public.reserva_hospedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id text NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  /* True para quem fez a reserva. Redundante com bookings.hospede_id de
     propósito: permite ler a lista completa de uma reserva com um só select,
     que é o que o SIBA e o check-in precisam. */
  principal boolean NOT NULL DEFAULT false,
  owner_id text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- A mesma pessoa não entra duas vezes na mesma reserva.
CREATE UNIQUE INDEX IF NOT EXISTS reserva_hospedes_unico_idx
  ON public.reserva_hospedes (booking_id, guest_id);

CREATE INDEX IF NOT EXISTS reserva_hospedes_booking_idx
  ON public.reserva_hospedes (booking_id);
CREATE INDEX IF NOT EXISTS reserva_hospedes_guest_idx
  ON public.reserva_hospedes (guest_id);
CREATE INDEX IF NOT EXISTS reserva_hospedes_owner_idx
  ON public.reserva_hospedes (owner_id);

ALTER TABLE public.reserva_hospedes ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só o service_role lhe toca, como nas restantes tabelas que
-- guardam dados de identificação.

COMMENT ON TABLE public.reserva_hospedes IS
  'Hóspedes de cada reserva. O boletim de alojamento é por pessoa — uma reserva de 8 precisa de 8 boletins.';
COMMENT ON COLUMN public.reserva_hospedes.principal IS
  'Quem fez a reserva. Corresponde a bookings.hospede_id.';

-- Retoma o histórico: cada reserva com hóspede passa a ter a ligação do
-- principal, para o código novo poder assumir que a tabela é a fonte de
-- verdade sem casos especiais para dados antigos.
INSERT INTO public.reserva_hospedes (booking_id, guest_id, principal, owner_id)
SELECT b.id, b.hospede_id, true, b.owner_id
FROM public.bookings b
WHERE b.hospede_id IS NOT NULL
ON CONFLICT (booking_id, guest_id) DO NOTHING;
