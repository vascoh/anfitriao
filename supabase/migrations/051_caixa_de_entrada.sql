-- 051 · Caixa de entrada unificada
--
-- Uma conversa por reserva, com mensagens de vários canais na mesma linha do
-- tempo. Email e WhatsApp entram e saem pela aplicação; o que chega por
-- Airbnb, Booking.com, SMS ou telefone regista-se à mão (colar a mensagem),
-- até haver ligações API a essas plataformas.
--
-- Só o servidor (service_role) lê e escreve: as rotas filtram por owner_id da
-- sessão Clerk, e os webhooks de entrada resolvem o dono pela reserva ou pela
-- ligação WhatsApp. Sem policies para anon/authenticated.

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  reserva_id text references public.bookings(id) on delete set null,
  hospede_id text references public.guests(id) on delete set null,
  canal text not null check (canal in ('email', 'whatsapp', 'sms', 'airbnb', 'booking', 'outro')),
  direcao text not null check (direcao in ('entrada', 'saida')),
  -- recebida: chegou por webhook · registada: colada/aberta à mão
  -- enviada/falhou: saiu pela aplicação
  estado text not null check (estado in ('recebida', 'registada', 'enviada', 'falhou')),
  assunto text check (assunto is null or char_length(assunto) <= 300),
  corpo text not null check (char_length(corpo) between 1 and 20000),
  -- Email ou telefone do hóspede neste canal; chave da conversa sem reserva.
  contacto text check (contacto is null or char_length(contacto) <= 320),
  nome_contacto text check (nome_contacto is null or char_length(nome_contacto) <= 200),
  -- Id do fornecedor (Resend, Meta): idempotência dos webhooks.
  id_externo text,
  sugerida_por_ia boolean not null default false,
  lida_em timestamptz,
  erro text,
  criado_em timestamptz not null default now()
);

create unique index if not exists mensagens_canal_id_externo_idx
  on public.mensagens (canal, id_externo) where id_externo is not null;
create index if not exists mensagens_owner_criado_idx on public.mensagens (owner_id, criado_em desc);
create index if not exists mensagens_reserva_idx on public.mensagens (reserva_id, criado_em);
create index if not exists mensagens_por_ler_idx
  on public.mensagens (owner_id) where direcao = 'entrada' and lida_em is null;

alter table public.mensagens enable row level security;

-- Número de WhatsApp Business de cada anfitrião (Cloud API da Meta).
-- O token e o segredo da app vivem cifrados (lib/crypto.ts, AES-256-GCM);
-- o webhook encontra o dono pelo phone_number_id que a Meta envia.
create table if not exists public.whatsapp_ligacoes (
  owner_id text primary key,
  phone_number_id text not null unique,
  numero_exibido text,
  token_cifrado text not null,
  app_secret_cifrado text not null,
  verify_token text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.whatsapp_ligacoes enable row level security;
