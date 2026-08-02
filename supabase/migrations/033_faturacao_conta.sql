-- Faturação: uma conta certificada por anfitrião, criada por nós.
--
-- O desenho anterior tinha uma única conta InvoiceXpress em variáveis de
-- ambiente. Está errado em multi-tenant e é ilegal na prática: a fatura tem
-- de ser emitida **pelo NIF do anfitrião**, não pelo nosso. Um documento
-- emitido pela nossa entidade não serve a contabilidade dele e mistura a
-- receita das duas empresas.
--
-- Desenho novo: o Anfitrião é parceiro do InvoiceXpress e cria, com a sua
-- chave de parceiro, **uma conta por anfitrião** (POST /api/accounts/create).
-- A conta é do anfitrião — NIF dele, credenciais AT dele, séries dele — mas o
-- custo está incluído na subscrição e ele nunca tem de a configurar à mão.
--
-- A chave devolvida por essa conta dá acesso total à faturação de quem a
-- possui. Guardada encriptada (`lib/crypto.ts`), como a chave do SIBA.

CREATE TABLE IF NOT EXISTS public.faturacao_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,

  -- 'invoicexpress' hoje; a coluna existe para o dia em que houver Vendus/Moloni.
  fornecedor text NOT NULL DEFAULT 'invoicexpress',

  -- Subdomínio da conta: {conta}.app.invoicexpress.com
  conta text NOT NULL,
  conta_id text,
  -- Chave da conta do anfitrião, encriptada. Nunca sai do servidor.
  api_key text NOT NULL,

  -- Dados fiscais com que a conta foi criada, para os podermos mostrar.
  nome_fiscal text NOT NULL,
  nif text,

  /* Comunicação à AT.
     Sem as credenciais de subutilizador da AT (NIF/1 + senha) o InvoiceXpress
     não consegue registar séries, e sem série registada não há numeração
     legal. É por isso um estado próprio e não um booleano perdido. */
  at_estado text NOT NULL DEFAULT 'por_configurar'
    CHECK (at_estado IN ('por_configurar', 'configurada', 'falhou')),
  at_erro text,
  at_configurada_em timestamptz,

  -- Série de documentos usada para emitir. Registada na AT.
  serie_id text,
  serie_nome text,

  estado text NOT NULL DEFAULT 'ativa' CHECK (estado IN ('ativa', 'suspensa')),

  /* Emissão automática no checkout. É a diferença entre "podes faturar aqui"
     e "as tuas faturas estão feitas" — e é o ponto onde isto passa a valer o
     preço. Opcional porque quem tem contabilista com outro método pode não
     querer. */
  emissao_automatica boolean NOT NULL DEFAULT true,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Uma conta por anfitrião e fornecedor.
CREATE UNIQUE INDEX IF NOT EXISTS faturacao_contas_owner_idx
  ON public.faturacao_contas (owner_id, fornecedor);

ALTER TABLE public.faturacao_contas ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só o service_role lhe toca. Guarda uma chave de API.

COMMENT ON TABLE public.faturacao_contas IS
  'Conta de faturação certificada de cada anfitrião, criada pela chave de parceiro do Anfitrião. A fatura é emitida pelo NIF do anfitrião.';
COMMENT ON COLUMN public.faturacao_contas.api_key IS
  'Chave da conta do anfitrião no fornecedor, encriptada (lib/crypto.ts). Nunca expor ao cliente.';

-- Notas de crédito: uma reserva cancelada depois de faturada anula-se por
-- nota de crédito, não por apagar a fatura. Guarda-se a referência.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS nota_credito_id_externo text,
  ADD COLUMN IF NOT EXISTS nota_credito_numero text,
  ADD COLUMN IF NOT EXISTS nota_credito_emitida_em timestamptz;

COMMENT ON COLUMN public.bookings.nota_credito_numero IS
  'Número da nota de crédito que anulou a fatura desta reserva.';

-- O painel de faturação lê sempre por dono e estado.
CREATE INDEX IF NOT EXISTS bookings_owner_fatura_estado_idx
  ON public.bookings (owner_id, fatura_estado);
