-- 057 · Limpezas entre hóspedes
--
-- O plano de limpezas é derivado das reservas (lib/limpezas.ts): cada saída é
-- uma limpeza. Aqui guarda-se só o que alguém disse sobre ela — feita, com
-- problema, uma nota — e os links que o anfitrião dá à equipa de limpeza.
--
-- O link da equipa não tem login: é um token aleatório, guardado só como
-- SHA-256 (quem lê a base não consegue abrir o link). Mostra quartos, datas e
-- número de hóspedes — nunca nomes, contactos ou preços.
--
-- Só service_role (RLS sem policies), como `mensagens`.

create table if not exists public.limpezas (
  propriedade_id text not null,
  data date not null,
  owner_id text not null,
  estado text not null check (estado in ('feita', 'problema')),
  nota text check (nota is null or char_length(nota) <= 500),
  por text check (por is null or char_length(por) <= 60),
  atualizado_em timestamptz not null default now(),
  primary key (propriedade_id, data)
);

create index if not exists limpezas_owner_data_idx on public.limpezas (owner_id, data);

alter table public.limpezas enable row level security;
revoke all on table public.limpezas from anon, authenticated;

create table if not exists public.limpeza_acessos (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  nome text not null check (char_length(nome) between 1 and 60),
  token_hash text not null unique,
  -- Vazio = todos os alojamentos, incluindo os que se criarem depois.
  propriedade_ids text[] not null default '{}',
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz,
  revogado_em timestamptz
);

create index if not exists limpeza_acessos_owner_idx on public.limpeza_acessos (owner_id) where revogado_em is null;

alter table public.limpeza_acessos enable row level security;
revoke all on table public.limpeza_acessos from anon, authenticated;
