-- 055 · Trincos para a sincronização iCal + UID externo único por alojamento
--
-- A sincronização deixa de correr uma vez por dia e passa a correr de 15 em
-- 15 minutos (pg_cron, ver 056). Com isso passa a ser normal haver duas
-- passagens ao mesmo tempo: o cron das 04:00 da Vercel, o do Supabase e o
-- botão «sincronizar» do anfitrião. Duas passagens que leem a mesma lista de
-- reservas importadas antes de qualquer uma inserir inserem as duas o mesmo
-- evento — o calendário fica com a reserva em duplicado.
--
-- Duas defesas, de propósito:
--  1. Um trinco com prazo (`adquirir_trinco`): só uma passagem por alojamento
--     de cada vez. O prazo existe para que uma função que morra a meio não
--     tranque o alojamento para sempre.
--  2. Um índice único em (propriedade_id, uid_externo): se o trinco falhar
--     (base lenta, prazo esgotado), a segunda inserção é recusada pela base em
--     vez de duplicar. Verificado a 2026-10-31: zero duplicados em produção.

create table if not exists public.trincos (
  chave text primary key,
  dono text not null,
  ate timestamptz not null
);

alter table public.trincos enable row level security;
-- Sem políticas: só o service_role lhe toca.

create or replace function public.adquirir_trinco(
  p_chave text,
  p_dono text,
  p_segundos integer
) returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_dono text;
begin
  insert into public.trincos as t (chave, dono, ate)
  values (p_chave, p_dono, now() + make_interval(secs => p_segundos))
  on conflict (chave) do update
    set dono = excluded.dono, ate = excluded.ate
    where t.ate < now()
  returning t.dono into v_dono;

  return coalesce(v_dono = p_dono, false);
end;
$$;

create or replace function public.libertar_trinco(
  p_chave text,
  p_dono text
) returns void
language sql
set search_path = public, pg_temp
as $$
  delete from public.trincos where chave = p_chave and dono = p_dono;
$$;

revoke all on function public.adquirir_trinco(text, text, integer) from public, anon, authenticated;
revoke all on function public.libertar_trinco(text, text) from public, anon, authenticated;
grant execute on function public.adquirir_trinco(text, text, integer) to service_role;
grant execute on function public.libertar_trinco(text, text) to service_role;

create unique index if not exists bookings_propriedade_uid_externo_uniq
  on public.bookings (propriedade_id, uid_externo)
  where uid_externo is not null;
