-- 059 · Alerta de canais partidos de hora a hora, em horas acordadas
--
-- O `/api/cron/canais-alertas` só corria às 06:00 (cron da Vercel, Hobby =
-- uma vez por dia). Desde que a sincronização é de 15 em 15 minutos (056), um
-- feed que parte às 07:00 ficava até ao dia seguinte a fazer recusar reservas
-- diretas sem o anfitrião saber. Aqui passa a correr de hora a hora, das 07:30
-- às 21:30 UTC (08:30–22:30 em Lisboa no verão), com o mesmo segredo do Vault
-- que a 056. A rota manda push e email uma vez por dia por anfitrião
-- (`envios_unicos`), por isso as passagens repetidas não repetem o aviso.
-- O cron das 06:00 da Vercel fica como rede.

select cron.schedule(
  'anfitriao-canais-alertas',
  '30 7-21 * * *',
  $cmd$
  select net.http_get(
    url := 'https://anfitrioes.pt/api/cron/canais-alertas',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'anfitriao_cron_externo'
      )
    ),
    timeout_milliseconds := 60000
  );
  $cmd$
);
