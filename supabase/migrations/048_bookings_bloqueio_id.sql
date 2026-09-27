-- 048 · Uma reserva pode viver dentro de um bloqueio importado
--
-- Porquê
-- ------
-- Com o Amenitiz no meio, as reservas do Airbnb e do Booking chegam como
-- «Quarto indisponível» — um bloqueio sem hóspede, que por vezes junta várias
-- reservas seguidas. Não havia forma de pôr o hóspede real no fluxo
-- (check-in, boletim SIBA, fatura): criar a reserva à mão nessas datas era
-- recusado como conflito com o próprio bloqueio.
--
-- `bloqueio_id` liga a reserva ao bloqueio de onde veio. O servidor só aceita
-- a ligação se o bloqueio for mesmo um bloqueio do mesmo dono e alojamento, e
-- se as datas couberem nele (`lib/reserva-no-bloqueio.ts`); com isso, e só
-- com isso, a sobreposição com esse bloqueio deixa de ser conflito.
--
-- Nunca entra no feed «diretas» que o Amenitiz lê: para ele é uma reserva que
-- ele próprio já tem.

alter table public.bookings
  add column if not exists bloqueio_id text references public.bookings(id) on delete set null;

alter table public.bookings drop constraint if exists bookings_bloqueio_id_diferente;
alter table public.bookings
  add constraint bookings_bloqueio_id_diferente check (bloqueio_id is null or bloqueio_id <> id);

create index if not exists bookings_bloqueio_id_idx on public.bookings (bloqueio_id) where bloqueio_id is not null;
