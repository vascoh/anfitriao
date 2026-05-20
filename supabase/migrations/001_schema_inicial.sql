-- ============================================================
-- 001 Schema inicial: tabelas base do Anfitrião
-- Aplicar via Supabase Dashboard → SQL Editor
-- ============================================================

-- Propriedades
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'apartamento',
  endereco TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  capacidade INTEGER NOT NULL DEFAULT 2,
  quartos INTEGER NOT NULL DEFAULT 1,
  casas_banho INTEGER NOT NULL DEFAULT 1,
  comodidades TEXT[] DEFAULT '{}',
  descricao TEXT,
  imagem_url TEXT,
  instrucoes_checkin TEXT NOT NULL DEFAULT '',
  regras_casa TEXT NOT NULL DEFAULT '',
  preco_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_limpeza DECIMAL(10,2) DEFAULT 0,
  cor TEXT NOT NULL DEFAULT '#C2714F',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ical_feeds JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hóspedes
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  nacionalidade TEXT,
  numero_documento TEXT,
  data_nascimento DATE,
  tipo_documento TEXT,
  sexo TEXT,
  pais_emissao TEXT,
  data_validade_doc DATE,
  tags TEXT[] DEFAULT '{}',
  notas TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reservas
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  hospede_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_hospedes INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'pendente',
  origem TEXT NOT NULL DEFAULT 'direto',
  preco_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_pago DECIMAL(10,2) NOT NULL DEFAULT 0,
  notas TEXT,
  uid_externo TEXT,
  historico JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurações do website
CREATE TABLE IF NOT EXISTS website_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  nome TEXT NOT NULL DEFAULT 'Reservas Diretas',
  descricao TEXT NOT NULL DEFAULT '',
  logo_texto TEXT,
  host_nome TEXT,
  host_bio TEXT,
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  min_noites INTEGER NOT NULL DEFAULT 1,
  antecedencia_dias INTEGER NOT NULL DEFAULT 1
);

-- Inserir configuração padrão se não existir
INSERT INTO website_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
