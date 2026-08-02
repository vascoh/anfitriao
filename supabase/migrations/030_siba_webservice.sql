-- Submissão automática de boletins ao SIBA por web service (ANF-4.7/4.9).
--
-- O placeholder anterior (`lib/siba-api.ts`) assumia credenciais de entidade
-- da plataforma junto da AIMA, guardadas em variáveis de ambiente. Está
-- errado nos dois eixos: o serviço é público e documentado
-- (https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx?WSDL) e as
-- credenciais são **do anfitrião, por estabelecimento** — obtidas ao registar
-- a unidade na área reservada do portal SIBA escolhendo o modo "Web Service".
--
-- Logo: vivem na propriedade, como os restantes campos de conformidade
-- (migração 027), e não no ambiente.
--
-- A chave de acesso é uma credencial perante o Estado: quem a tiver submete
-- boletins em nome do anfitrião. Guardada encriptada (AES-256-GCM,
-- `lib/crypto.ts`); a aplicação recusa gravar se não houver chave de
-- encriptação configurada, em vez de a guardar em claro.

ALTER TABLE public.properties
  -- NIPC/NIF da unidade hoteleira (parâmetro `UnidadeHoteleira`).
  ADD COLUMN IF NOT EXISTS siba_nipc text,
  -- Número do estabelecimento atribuído pelo SEF/AIMA. O primeiro é "00".
  ADD COLUMN IF NOT EXISTS siba_estabelecimento text,
  -- Chave de acesso, encriptada. Nunca em claro, nunca devolvida ao browser.
  ADD COLUMN IF NOT EXISTS siba_chave_acesso text,
  -- Campos do bloco Unidade_Hoteleira que a app ainda não tinha.
  ADD COLUMN IF NOT EXISTS siba_abreviatura text,
  ADD COLUMN IF NOT EXISTS siba_codigo_postal text,
  ADD COLUMN IF NOT EXISTS siba_telefone text,
  ADD COLUMN IF NOT EXISTS siba_nome_contacto text,
  ADD COLUMN IF NOT EXISTS siba_email_contacto text;

COMMENT ON COLUMN public.properties.siba_chave_acesso IS
  'Chave de acesso ao web service do SIBA, encriptada (lib/crypto.ts). Credencial do anfitrião perante a AIMA — nunca guardar em claro nem expor ao cliente.';
COMMENT ON COLUMN public.properties.siba_estabelecimento IS
  'Número de estabelecimento atribuído pelo SEF/AIMA no registo. O primeiro de um NIPC é "00".';

-- Prova de submissão.
--
-- Todos os concorrentes vendem a *submissão*. O que interessa no dia de uma
-- fiscalização é a *prova*: que aqueles hóspedes, com aqueles dados, foram
-- entregues naquele momento. Guarda-se a impressão digital do que foi enviado
-- e a resposta em bruto do serviço.
-- Nota: `properties.id`, `bookings.id` e `guests.id` são `text` em produção,
-- apesar de a migração 001 os declarar `UUID` — a base foi criada antes e as
-- migrações seguintes nunca a alinharam. As chaves aqui seguem o que existe,
-- não o que o ficheiro 001 diz.
CREATE TABLE IF NOT EXISTS public.siba_submissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text,
  property_id text REFERENCES public.properties(id) ON DELETE SET NULL,
  -- Reservas incluídas neste movimento.
  booking_ids text[] NOT NULL DEFAULT '{}',
  -- Número sequencial do ficheiro, por propriedade, exigido pelo bloco Envio.
  numero_ficheiro integer NOT NULL,
  -- SHA-256 do XML MovimentoBAL enviado.
  hash_envio text NOT NULL,
  sucesso boolean NOT NULL,
  codigo_retorno text,
  mensagem text,
  -- Resposta tal como veio do serviço, para prova.
  resposta_bruta text,
  tentativas integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.siba_submissoes ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só o service_role lhe toca, como em push_subscriptions.
-- É um registo de prova — a aplicação lê-o pelas rotas, o browser nunca.

CREATE INDEX IF NOT EXISTS siba_submissoes_owner_idx
  ON public.siba_submissoes (owner_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS siba_submissoes_property_idx
  ON public.siba_submissoes (property_id, numero_ficheiro DESC);

COMMENT ON TABLE public.siba_submissoes IS
  'Prova de entrega de boletins ao SIBA: o que foi enviado (hash), quando, e o que o serviço respondeu.';
