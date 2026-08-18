-- Regenera `supabase/schema.sql` a partir da base de PRODUÇÃO.
--
-- As migrações não são a fonte de verdade (ver o cabeçalho do schema.sql).
-- Correr isto no editor SQL do Supabase e colar o resultado no ficheiro,
-- mantendo o cabeçalho.
--
--   psql "$DATABASE_URL" -At -f scripts/schema-dump.sql
--
select string_agg(bloco, E'\n\n' order by tabela) as ddl
from (
  select
    c.relname as tabela,
    'CREATE TABLE public.' || c.relname || ' (' || E'\n' ||
    string_agg(
      '  ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
        || case when a.attnotnull then ' NOT NULL' else '' end
        || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), ''),
      ',' || E'\n' order by a.attnum
    ) || E'\n);' as bloco
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind = 'r'
    -- Tabelas de outros projetos que partilham a base ficam de fora.
    and c.relname not like 'fs\_%'
    and c.relname not like 'blocos\_%'
  group by c.relname
) t;
