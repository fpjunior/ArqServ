-- ============================================
-- SCRIPT DE ATUALIZAÇÃO DO BANCO DE DADOS
-- Adiciona apenas as colunas que estão faltando
-- ============================================

-- ============================================
-- 1. ADICIONAR COLUNAS FALTANTES EM SERVERS
-- ============================================

-- Adicionar drive_folder_id na tabela servers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'servers' AND column_name = 'drive_folder_id'
    ) THEN
        ALTER TABLE servers ADD COLUMN drive_folder_id VARCHAR(255);
        RAISE NOTICE '✅ Coluna drive_folder_id adicionada em servers';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna drive_folder_id já existe em servers';
    END IF;
END $$;

-- Adicionar is_active na tabela servers (já tem active, mas backend usa is_active)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'servers' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE servers ADD COLUMN is_active BOOLEAN DEFAULT true;
        -- Copiar valores de active para is_active
        UPDATE servers SET is_active = active;
        RAISE NOTICE '✅ Coluna is_active adicionada em servers';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna is_active já existe em servers';
    END IF;
END $$;

-- Adicionar updated_at na tabela servers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'servers' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE servers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE '✅ Coluna updated_at adicionada em servers';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna updated_at já existe em servers';
    END IF;
END $$;

-- ============================================
-- 2. ADICIONAR COLUNAS FALTANTES EM DOCUMENTS
-- ============================================

-- Adicionar document_type
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'document_type'
    ) THEN
        ALTER TABLE documents ADD COLUMN document_type VARCHAR(20) DEFAULT 'servidor';
        RAISE NOTICE '✅ Coluna document_type adicionada em documents';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna document_type já existe em documents';
    END IF;
END $$;

-- Adicionar financial_document_type
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'financial_document_type'
    ) THEN
        ALTER TABLE documents ADD COLUMN financial_document_type VARCHAR(100);
        RAISE NOTICE '✅ Coluna financial_document_type adicionada em documents';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna financial_document_type já existe em documents';
    END IF;
END $$;

-- Adicionar financial_year
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'financial_year'
    ) THEN
        ALTER TABLE documents ADD COLUMN financial_year INTEGER;
        RAISE NOTICE '✅ Coluna financial_year adicionada em documents';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna financial_year já existe em documents';
    END IF;
END $$;

-- Adicionar financial_period
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'financial_period'
    ) THEN
        ALTER TABLE documents ADD COLUMN financial_period VARCHAR(20);
        RAISE NOTICE '✅ Coluna financial_period adicionada em documents';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna financial_period já existe em documents';
    END IF;
END $$;

-- Adicionar hierarchical_path
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'hierarchical_path'
    ) THEN
        ALTER TABLE documents ADD COLUMN hierarchical_path TEXT;
        RAISE NOTICE '✅ Coluna hierarchical_path adicionada em documents';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna hierarchical_path já existe em documents';
    END IF;
END $$;

-- Tornar municipality_code opcional em documents (atualmente é NOT NULL)
DO $$ 
BEGIN
    ALTER TABLE documents ALTER COLUMN municipality_code DROP NOT NULL;
    RAISE NOTICE '✅ Coluna municipality_code agora é opcional em documents';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Não foi possível tornar municipality_code opcional: %', SQLERRM;
END $$;

-- ============================================
-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_financial_year ON documents(financial_year);
CREATE INDEX IF NOT EXISTS idx_servers_is_active ON servers(is_active);

-- ============================================
-- 4. CRIAR TRIGGER DE UPDATED_AT PARA SERVERS
-- ============================================

-- Função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para servers
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS trigger_servers_updated_at ON servers;
    CREATE TRIGGER trigger_servers_updated_at
        BEFORE UPDATE ON servers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE '✅ Trigger de updated_at criado para servers';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao criar trigger: %', SQLERRM;
END $$;

-- ============================================
-- 5. INSERIR DADOS DE EXEMPLO (OPCIONAL)
-- ============================================

-- Inserir municípios de exemplo (apenas se não existirem)
INSERT INTO municipalities (code, name, state) VALUES
('2600500', 'Aliança', 'PE'),
('2600609', 'Amaraji', 'PE'),
('2600708', 'Araçoiaba', 'PE'),
('2604106', 'Condado', 'PE'),
('2611101', 'Palmares', 'PE'),
('2615607', 'Vertente', 'PE')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================

-- Verificar colunas adicionadas em servers
SELECT 
    'servers' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'servers' 
    AND column_name IN ('drive_folder_id', 'is_active', 'updated_at')
ORDER BY column_name;

-- Verificar colunas adicionadas em documents
SELECT 
    'documents' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'documents' 
    AND column_name IN ('document_type', 'financial_document_type', 'financial_year', 'financial_period', 'hierarchical_path')
ORDER BY column_name;

-- ============================================
-- SCRIPT FINALIZADO
-- ============================================

SELECT '✅ Banco de dados atualizado com sucesso!' as status;
