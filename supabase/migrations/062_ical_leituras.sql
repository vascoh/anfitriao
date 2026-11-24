-- 062 · Quem lê o calendário que exportamos
--
-- Depois de colar o endereço de /api/ical/[id] no Airbnb ou no Booking, nada
-- confirmava ao anfitrião que eles o estão de facto a ler — e no dia do corte
-- do Amenitiz é esse feed que impede uma plataforma de vender por cima de
-- outra. Uma linha por (alojamento, leitor, tipo de feed), com a hora da última
-- leitura. Só o user-agent (de servidores de plataformas, truncado); nunca o IP.
-- Ver src/lib/ical-leitores.ts.
create table if not exists public.ical_leituras (
  propriedade_id text not null,
  leitor text not null,
  origem text not null default 'todas' check (origem in ('todas', 'diretas')),
  owner_id text,
  user_agent text,
  ultima_leitura timestamptz not null default now(),
  primeira_leitura timestamptz not null default now(),
  primary key (propriedade_id, leitor, origem)
);

create index if not exists ical_leituras_owner_idx on public.ical_leituras (owner_id);

alter table public.ical_leituras enable row level security;

drop policy if exists ical_leituras_owner_select on public.ical_leituras;
create policy ical_leituras_owner_select on public.ical_leituras
  for select to authenticated
  using (owner_id = requesting_owner_id());
-- Escritas só pelo servidor (service_role), no feed público.
