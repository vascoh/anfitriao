-- 053 · respostas_guardadas — modelos de resposta da caixa de entrada
--
-- Com a IA desligada (lib/ia.ts), o anfitrião escrevia as mesmas respostas à
-- mão: instruções de chegada, wifi, check-out. Cada modelo leva variáveis da
-- reserva ({nome}, {checkin}, {link_checkin}, …) preenchidas no browser.
--
-- Só service_role (RLS sem policies), como `mensagens`.

create table if not exists public.respostas_guardadas (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  titulo text not null check (char_length(titulo) between 1 and 80),
  corpo text not null check (char_length(corpo) between 1 and 5000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists respostas_guardadas_owner_idx on public.respostas_guardadas (owner_id, titulo);

alter table public.respostas_guardadas enable row level security;
revoke all on table public.respostas_guardadas from anon, authenticated;
