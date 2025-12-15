-- Criar tabela de tipos de documentos financeiros
CREATE TABLE IF NOT EXISTS financial_document_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_financial_document_types_code ON financial_document_types(code);
CREATE INDEX IF NOT EXISTS idx_financial_document_types_active ON financial_document_types(is_active);

-- Popular com dados existentes
INSERT INTO financial_document_types (code, name, description) VALUES
  ('balanco', 'Balanço Patrimonial', 'Demonstrativo contábil do patrimônio'),
  ('orcamento', 'Orçamento Anual', 'Planejamento orçamentário anual'),
  ('prestacao-contas', 'Prestação de Contas', 'Relatório de prestação de contas'),
  ('receitas', 'Relatório de Receitas', 'Demonstrativo de receitas'),
  ('despesas', 'Relatório de Despesas', 'Demonstrativo de despesas'),
  ('licitacoes', 'Licitações e Contratos', 'Documentos de licitações e contratos'),
  ('folha-pagamento', 'Folha de Pagamento', 'Folha de pagamento de servidores'),
  ('outros', 'Outros', 'Outros documentos financeiros')
ON CONFLICT (code) DO NOTHING;

-- Habilitar RLS (Row Level Security)
ALTER TABLE financial_document_types ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler tipos ativos
DROP POLICY IF EXISTS "Todos podem ler tipos ativos" ON financial_document_types;
CREATE POLICY "Todos podem ler tipos ativos"
  ON financial_document_types
  FOR SELECT
  USING (is_active = true);

-- Política: Apenas admins podem inserir/atualizar
-- CORREÇÃO: Usando email para linkar usuário, pois users.id é integer e auth.uid() é uuid
DROP POLICY IF EXISTS "Apenas admins podem modificar tipos" ON financial_document_types;
CREATE POLICY "Apenas admins podem modificar tipos"
  ON financial_document_types
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND users.role = 'admin'
    )
  );
