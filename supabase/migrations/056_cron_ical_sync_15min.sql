-- 056 · Sincronização iCal de 15 em 15 minutos, agendada no Supabase
--
-- O plano Hobby da Vercel só deixa os crons do `vercel.json` correr uma vez
-- por dia, e isso era o ponto 1 de «O que tem de ser verdade no dia do corte»
-- (docs/MIGRACAO-AMENITIZ.md): sem o Amenitiz, a janela em que duas
-- plataformas podem vender a mesma noite é o intervalo entre sincronizações.
--
-- O pg_cron do Supabase não tem esse limite. Chama a mesma rota que o cron da
-- Vercel (`GET /api/ical-sync`), com um segredo próprio guardado no Vault e
-- definido na Vercel como `CRON_SECRET_EXTERNO` (ver `lib/cron-auth.ts`). O
-- cron diário das 04:00 fica no `vercel.json` como rede: se este parar, o
-- calendário continua a encher-se uma vez por dia.
--
-- Passagens sobrepostas não duplicam reservas: trinco por alojamento e índice
-- único (migração 055).
--
-- O segredo é gerado na base, não no repositório. Para o rodar:
--   update vault.secrets set secret = encode(extensions.gen_random_bytes(32), 'hex')
--     where name = 'anfitriao_cron_externo';   -- via vault.update_secret
-- e copiar o novo valor para `CRON_SECRET_EXTERNO` na Vercel (Production).

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'anfitriao_cron_externo') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'anfitriao_cron_externo',
      'Bearer de /api/ical-sync chamado pelo pg_cron (CRON_SECRET_EXTERNO na Vercel)'
    );
  end if;
end $$;

select cron.schedule(
  'anfitriao-ical-sync',
  '*/15 * * * *',
  $cmd$
  select net.http_get(
    url := 'https://anfitrioes.pt/api/ical-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'anfitriao_cron_externo'
      )
    ),
    timeout_milliseconds := 120000
  );
  $cmd$
);
