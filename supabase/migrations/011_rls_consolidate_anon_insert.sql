-- 011_rls_consolidate_anon_insert.sql
-- Aplicada em produção 2026-06-30 (migration `consolidate_redundant_anon_insert_policies`).
--
-- Consolida policies anon de INSERT duplicadas/superset em bookings e guests. Os inserts
-- públicos passam por /api/book (createAdminClient: service_role, ou fallback anon-key).
-- Seguro em ambos os cenários:
--  - bookings: todo o insert anon traz origem='direto', logo public_insert_bookings cobre-o;
--    bookings_public_insert (WITH CHECK true) era superset redundante -> removida.
--  - guests: guests_checkin_insert e public_insert_guests eram idênticas (WITH CHECK true);
--    o check-in não faz insert anon (usa service_role), mantém-se public_insert_guests.
--
-- Estado final do advisor: 1 WARN (public_insert_guests, anon INSERT WITH CHECK true) —
-- irredutível: submissão pública de hóspede insert-only; não estreitável por owner_id porque
-- /api/book pode inserir com owner_id nulo (propriedade sem owner). Padrão legítimo.

DROP POLICY IF EXISTS bookings_public_insert ON public.bookings;   -- superset de public_insert_bookings (origem='direto')
DROP POLICY IF EXISTS guests_checkin_insert ON public.guests;      -- duplicado de public_insert_guests
