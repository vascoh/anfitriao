-- Esquema da base de dados de PRODUÇÃO — gerado, não escrito à mão.
--
-- Gerado a 2026-08-18 a partir do projeto `nnbqfrszukkzoqwssjvg`.
--
-- ## Porque é que este ficheiro existe
--
-- As migrações em `supabase/migrations/` **não são a fonte de verdade**. A
-- migração 001 declara `properties.id`, `bookings.id` e `guests.id` como
-- `UUID`; em produção são `text`. Quem escrever DDL a partir dos ficheiros de
-- migração assume tipos que não existem — aconteceu a 2026-08-03, ao construir
-- o SIBA, e falhou à primeira tentativa.
--
-- Este ficheiro é uma fotografia do que **está lá**. Não se aplica a nada:
-- serve para ler antes de escrever uma migração nova, e para comparar quando
-- alguma coisa não bate certo.
--
-- Não inclui índices, chaves estrangeiras nem políticas de RLS — para esses o
-- painel do Supabase é a referência. Inclui as colunas, que é onde a deriva
-- costuma estar.
--
-- Tabelas de outros projetos que partilham esta base (`fs_*`, `blocos_*`)
-- ficam de fora de propósito.
--
-- Para regenerar: `scripts/schema-dump.sql`.

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  email text NOT NULL DEFAULT ''::text,
  nome text,
  plano text NOT NULL DEFAULT 'trial'::text,
  estado text NOT NULL DEFAULT 'trial'::text,
  trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
  propriedades_max integer NOT NULL DEFAULT 1,
  notas_admin text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_end timestamp with time zone,
  stripe_connect_account_id text,
  stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  stripe_connect_details_submitted boolean NOT NULL DEFAULT false
);

CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id text,
  entidade text NOT NULL,
  entidade_id text NOT NULL,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  booking_id text NOT NULL,
  executado_em timestamp with time zone NOT NULL DEFAULT now(),
  resultado text NOT NULL DEFAULT 'enviado'::text
);

CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  nome text NOT NULL,
  trigger_tipo automation_trigger NOT NULL,
  action_tipo automation_action NOT NULL DEFAULT 'email_hospede'::automation_action,
  assunto text NOT NULL DEFAULT ''::text,
  mensagem text NOT NULL DEFAULT ''::text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id text NOT NULL,
  propriedade_id text NOT NULL,
  hospede_id text,
  check_in text NOT NULL,
  check_out text NOT NULL,
  num_hospedes integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'pendente'::text,
  origem text NOT NULL DEFAULT 'direto'::text,
  preco_total numeric(10,2) NOT NULL DEFAULT 0,
  preco_pago numeric(10,2) NOT NULL DEFAULT 0,
  notas text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  uid_externo text,
  owner_id text,
  stripe_checkout_session_id text,
  siba_status text NOT NULL DEFAULT 'nao_submetido'::text,
  siba_submitted_at timestamp with time zone,
  siba_reference text,
  siba_error text,
  siba_metodo text,
  fatura_estado text NOT NULL DEFAULT 'nao_emitida'::text,
  fatura_id_externo text,
  fatura_numero text,
  fatura_atcud text,
  fatura_url text,
  fatura_total numeric(10,2),
  fatura_emitida_em timestamp with time zone,
  fatura_erro text,
  nota_credito_id_externo text,
  nota_credito_numero text,
  nota_credito_emitida_em timestamp with time zone,
  reserva_grupo_id text
);

CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text,
  propriedade_id text,
  categoria expense_categoria NOT NULL DEFAULT 'outro'::expense_categoria,
  descricao text NOT NULL DEFAULT ''::text,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.faturacao_contas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  fornecedor text NOT NULL DEFAULT 'invoicexpress'::text,
  conta text NOT NULL,
  conta_id text,
  api_key text NOT NULL,
  nome_fiscal text NOT NULL,
  nif text,
  at_estado text NOT NULL DEFAULT 'por_configurar'::text,
  at_erro text,
  at_configurada_em timestamp with time zone,
  serie_id text,
  serie_nome text,
  estado text NOT NULL DEFAULT 'ativa'::text,
  emissao_automatica boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.guests (
  id text NOT NULL,
  nome text NOT NULL,
  email text,
  telefone text,
  nacionalidade text,
  numero_documento text,
  data_nascimento text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  notas text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  tipo_documento text,
  sexo text,
  pais_emissao text,
  data_validade_doc text,
  owner_id text,
  anonimizado_em timestamp with time zone,
  anonimizado_grupos text[],
  retencao_completa boolean NOT NULL DEFAULT false,
  pais_residencia text,
  local_residencia text,
  nif text
);

CREATE TABLE public.notification_preferences (
  owner_id text NOT NULL,
  nova_reserva_email boolean NOT NULL DEFAULT true,
  nova_reserva_push boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_rates (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  property_id text NOT NULL,
  plataforma text NOT NULL,
  multiplicador numeric(5,3) NOT NULL DEFAULT 1.0,
  comissao_pct numeric(5,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  owner_id text
);

CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  slug text NOT NULL,
  titulo text NOT NULL,
  resumo text,
  conteudo text NOT NULL DEFAULT ''::text,
  imagem_capa text,
  publicado boolean NOT NULL DEFAULT false,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.price_change_log (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  property_id text NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  owner_id text
);

CREATE TABLE public.price_rules (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  property_id text NOT NULL,
  nome text NOT NULL DEFAULT 'Regra personalizada'::text,
  tipo text NOT NULL DEFAULT 'custom'::text,
  data_inicio date,
  data_fim date,
  dias_semana integer[],
  preco_noite numeric(10,2),
  taxa_limpeza numeric(10,2),
  desconto_pct numeric(5,2),
  min_noites integer,
  max_noites integer,
  prioridade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  owner_id text
);

CREATE TABLE public.properties (
  id text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'apartamento'::text,
  endereco text NOT NULL DEFAULT ''::text,
  cidade text NOT NULL DEFAULT ''::text,
  capacidade integer NOT NULL DEFAULT 2,
  quartos integer NOT NULL DEFAULT 1,
  casas_banho integer NOT NULL DEFAULT 1,
  comodidades text[] NOT NULL DEFAULT '{}'::text[],
  descricao text,
  imagem_url text,
  instrucoes_checkin text,
  regras_casa text,
  preco_base numeric(10,2) NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT '#C2714F'::text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  ical_feeds jsonb NOT NULL DEFAULT '[]'::jsonb,
  taxa_limpeza numeric(10,2) DEFAULT 0,
  parent_id text,
  owner_id text,
  fotos text[] NOT NULL DEFAULT '{}'::text[],
  mostrar_morada_publica boolean NOT NULL DEFAULT false,
  rnal_numero text,
  rnal_data date,
  seguro_seguradora text,
  seguro_apolice text,
  seguro_validade date,
  livro_reclamacoes_registado boolean NOT NULL DEFAULT false,
  livro_reclamacoes_url text,
  certificado_energetico_validade date,
  siba_nipc text,
  siba_estabelecimento text,
  siba_chave_acesso text,
  siba_abreviatura text,
  siba_codigo_postal text,
  siba_telefone text,
  siba_nome_contacto text,
  siba_email_contacto text
);

CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.reserva_hospedes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id text NOT NULL,
  guest_id text NOT NULL,
  principal boolean NOT NULL DEFAULT false,
  owner_id text,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.siba_submissoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text,
  property_id text,
  booking_ids text[] NOT NULL DEFAULT '{}'::text[],
  numero_ficheiro integer NOT NULL,
  hash_envio text NOT NULL,
  sucesso boolean NOT NULL,
  codigo_retorno text,
  mensagem text,
  resposta_bruta text,
  tentativas integer NOT NULL DEFAULT 1,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tarifas (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  property_id text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'standard'::text,
  desconto_pct numeric(5,2) NOT NULL DEFAULT 0,
  suplemento_valor numeric(10,2) NOT NULL DEFAULT 0,
  min_noites integer NOT NULL DEFAULT 1,
  max_noites integer,
  cancelamento_horas integer,
  politica_cancelamento text,
  plataformas text[],
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  owner_id text
);

CREATE TABLE public.website_settings (
  id integer NOT NULL DEFAULT nextval('website_settings_id_seq'::regclass),
  enabled boolean NOT NULL DEFAULT true,
  nome text NOT NULL DEFAULT 'Reservas Diretas'::text,
  descricao text NOT NULL DEFAULT 'Reserve diretamente connosco sem taxas de intermediários.'::text,
  logo_texto text,
  host_nome text,
  host_bio text,
  email text NOT NULL DEFAULT ''::text,
  telefone text NOT NULL DEFAULT ''::text,
  min_noites integer NOT NULL DEFAULT 1,
  antecedencia_dias integer NOT NULL DEFAULT 1,
  owner_id text,
  slug text,
  cor_primaria text,
  cor_secundaria text,
  idioma text DEFAULT 'pt'::text,
  email_reservas text,
  assinatura_email text,
  template_id text NOT NULL DEFAULT 'classico'::text,
  fonte text,
  secoes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.website_templates (
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT ''::text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);
