-- Remove políticas RLS anon de SELECT que expunham dados de TODOS os
-- inquilinos (não só o alojamento/reserva relevante) a qualquer visitante
-- anónimo. Não vazou dados reais até agora só porque as tabelas em causa
-- estavam vazias/single-tenant em produção — o mecanismo já estava pronto
-- para vazar assim que houvesse dados reais.
--
-- Achado numa auditoria de segurança (2026-07-26): `guests.public_read_guests_limited`
-- e `bookings.public_read_bookings_for_checkin` tinham `USING (true)` — leitura
-- total sem qualquer restrição, incluindo campos SIBA/SEF de hóspedes.
-- `bookings.bookings_public_read`, `properties.properties_public_read`,
-- `properties.public_read_active_properties` e `website_settings.public_read_website_settings`
-- filtravam por estado/ativo mas nunca por owner_id — uma query sem filtro
-- devolvia os dados de todos os anfitriões da plataforma.
--
-- Nenhuma destas políticas tem consumidor real no código: o check-in usa
-- service_role via /api/checkin; a página de confirmação de reserva passou a
-- usar /api/book-confirmation/[bookingId] (service_role, escopado ao id);
-- as páginas públicas /r/[slug] e /book/[propertyId] já usavam admin client
-- server-side. A rota legada /book (catálogo cross-tenant) foi substituída
-- por uma página estática sem acesso à BD.
--
-- As políticas de INSERT anon (public_insert_guests, public_insert_bookings)
-- NÃO são tocadas — são necessárias como fallback do fluxo de reserva quando
-- SUPABASE_SERVICE_ROLE_KEY não está definida (ver PROGRESS.md 2026-06-30).

DROP POLICY IF EXISTS "public_read_guests_limited" ON public.guests;
DROP POLICY IF EXISTS "public_read_bookings_for_checkin" ON public.bookings;
DROP POLICY IF EXISTS "bookings_public_read" ON public.bookings;
DROP POLICY IF EXISTS "properties_public_read" ON public.properties;
DROP POLICY IF EXISTS "public_read_active_properties" ON public.properties;
DROP POLICY IF EXISTS "website_settings_public_read" ON public.website_settings;
