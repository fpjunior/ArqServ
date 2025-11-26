-- Migração para adicionar suporte a documentações financeiras
-- Execute este script no banco de dados existente

-- Criar enum para tipo de documento se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
        CREATE TYPE document_type_enum AS ENUM ('servidor', 'financeira');
    END IF;
END $$;

-- Adicionar novas colunas à tabela documents
ALTER TABLE documents 
    ADD COLUMN IF NOT EXISTS document_type document_type_enum DEFAULT 'servidor',
    ADD COLUMN IF NOT EXISTS financial_document_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS financial_year INTEGER,
    ADD COLUMN IF NOT EXISTS financial_period VARCHAR(20),
    ADD COLUMN IF NOT EXISTS hierarchical_path TEXT;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_financial_type ON documents(financial_document_type);
CREATE INDEX IF NOT EXISTS idx_documents_financial_year ON documents(financial_year);

-- Atualizar comentários
COMMENT ON COLUMN documents.document_type IS 'Tipo do documento: servidor ou financeira';
COMMENT ON COLUMN documents.financial_document_type IS 'Tipo específico do documento financeiro (balanco, orcamento, etc.)';
COMMENT ON COLUMN documents.financial_year IS 'Ano do documento financeiro';
COMMENT ON COLUMN documents.financial_period IS 'Período do documento financeiro (trimestre/semestre)';
COMMENT ON COLUMN documents.hierarchical_path IS 'Caminho hierárquico completo no Google Drive';

-- Atualizar documentos existentes para tipo 'servidor'
UPDATE documents 
SET document_type = 'servidor' 
WHERE document_type IS NULL AND server_id IS NOT NULL;

-- Verificar estrutura atualizada
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'documents'
    AND column_name IN ('document_type', 'financial_document_type', 'financial_year', 'financial_period', 'hierarchical_path')
ORDER BY ordinal_position;