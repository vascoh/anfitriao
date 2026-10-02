-- 049 · Domínios próprios dos sites públicos
--
-- O registo do domínio continua no registrador escolhido pelo cliente. Esta
-- tabela guarda apenas o encaminhamento para o site certo e o estado da
-- configuração na Vercel. Um domínio e um anfitrião só podem ter uma associação.

create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null unique,
  dominio text not null unique check (dominio = lower(dominio)),
  slug text not null,
  verificado boolean not null default false,
  configurado boolean not null default false,
  estado text not null default 'pendente' check (estado in ('pendente', 'ativo', 'erro')),
  dns jsonb not null default '[]'::jsonb,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists custom_domains_dominio_idx on public.custom_domains (dominio);
create index if not exists custom_domains_slug_idx on public.custom_domains (slug);

alter table public.custom_domains enable row level security;

drop policy if exists custom_domains_owner_all on public.custom_domains;
create policy custom_domains_owner_all on public.custom_domains
  for all to authenticated
  using (owner_id = requesting_owner_id())
  with check (owner_id = requesting_owner_id());

-- As leituras públicas passam pelo servidor com service_role. Não há policy
-- anon: listar todos os domínios de clientes não faz parte do site público.
