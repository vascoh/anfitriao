-- Código da reserva do lado da plataforma (hoje: o «HM…» do Airbnb), tirado do
-- DESCRIPTION do feed iCal direto. Serve para o «Abrir no Airbnb» em
-- /reservas/[id] e /hoje. Só o código: o resto do DESCRIPTION (4 dígitos do
-- telefone) não se guarda. Ver src/lib/ical-referencias.ts.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS referencia_externa text;
