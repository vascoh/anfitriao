-- 050 · custom_domains sem privilégios para anon
--
-- O RLS já bloqueia leituras e escritas do anon (não há policy), mas os
-- privilégios por defeito do Supabase incluem TRUNCATE, que o RLS não cobre.
-- Os domínios só são lidos no servidor com service_role.

revoke all on table public.custom_domains from anon;
