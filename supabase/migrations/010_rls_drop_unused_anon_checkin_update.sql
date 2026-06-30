-- 010_rls_drop_unused_anon_checkin_update.sql
-- Aplicada em produção 2026-06-30 (migration `drop_unused_anon_checkin_update_policies`).
--
-- Remove as policies anon de UPDATE com USING(true) que permitiam a qualquer anónimo
-- reescrever qualquer reserva/hóspede. Verificado no código que o check-in atualiza
-- bookings.historico e guests exclusivamente via /api/checkin/[bookingId] com service_role
-- (a página cliente só faz fetch à rota) — não existe UPDATE anon na app. Não há coluna de
-- token de check-in (o bookings.id é o identificador da URL) e o RLS não restringe colunas,
-- pelo que "restringir por token" seria no-op; as policies foram removidas.

DROP POLICY IF EXISTS public_update_booking_historico ON public.bookings;
DROP POLICY IF EXISTS guests_checkin_update ON public.guests;
