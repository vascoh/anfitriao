-- ============================================================
-- 002 Sistema de preços: regras, tarifas, plataformas
-- Aplicar via Supabase Dashboard → SQL Editor
-- ============================================================

-- Regras de preço (por propriedade, intervalo de datas, dias da semana)
CREATE TABLE IF NOT EXISTS price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Regra personalizada',
  tipo TEXT NOT NULL DEFAULT 'custom',
  -- Período de aplicação (null = sempre)
  data_inicio DATE,
  data_fim DATE,
  -- Dias da semana (null = todos; 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab)
  dias_semana INTEGER[],
  -- Preços (null = usar valor da propriedade)
  preco_noite DECIMAL(10,2),
  taxa_limpeza DECIMAL(10,2),
  -- Ajuste percentual: -10 = -10%, +20 = +20% (aplicado em cima do preco_noite ou base)
  desconto_pct DECIMAL(5,2),
  -- Restrições de estadia
  min_noites INTEGER,
  max_noites INTEGER,
  -- Prioridade (maior ganha quando há sobreposição)
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_rules_property ON price_rules(property_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_dates ON price_rules(data_inicio, data_fim);

-- Tipos de tarifa
CREATE TABLE IF NOT EXISTS tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'standard',
  -- Ajuste de preço
  desconto_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  suplemento_valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Restrições
  min_noites INTEGER NOT NULL DEFAULT 1,
  max_noites INTEGER,
  -- Cancelamento
  cancelamento_horas INTEGER,
  politica_cancelamento TEXT,
  -- Plataformas (null = todas)
  plataformas TEXT[],
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarifas_property ON tarifas(property_id);

-- Taxas por plataforma
CREATE TABLE IF NOT EXISTS platform_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  -- Multiplicador: 1.15 = +15%, 0.90 = -10%
  multiplicador DECIMAL(5,3) NOT NULL DEFAULT 1.0,
  -- Comissão da plataforma (% para cálculo de receita líquida)
  comissao_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, plataforma)
);

CREATE INDEX IF NOT EXISTS idx_platform_rates_property ON platform_rates(property_id);

-- Log de alterações de preços (auditoria)
CREATE TABLE IF NOT EXISTS price_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'rule_created', 'rule_updated', 'bulk_update', 'base_price_changed'
  descricao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_change_log_property ON price_change_log(property_id);
