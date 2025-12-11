-- ============================================
-- TABELA DE LOGS DE ATIVIDADES
-- Sistema ArqServ - Rastreamento de Atividades
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Criar tabela de activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    -- Tipo de atividade: 'view', 'download', 'upload', 'edit', 'delete'
    activity_type VARCHAR(50) NOT NULL,
    -- ID do documento relacionado (opcional, pois pode ser ação geral)
    document_id INTEGER,
    -- ID do usuário que realizou a atividade
    user_id INTEGER,
    -- Código do município para facilitar filtros
    municipality_code VARCHAR(20),
    -- Informações adicionais em JSON (flexível para diferentes tipos de atividade)
    metadata JSONB DEFAULT '{}',
    -- IP do usuário (para auditoria)
    ip_address VARCHAR(45),
    -- User agent do navegador
    user_agent TEXT,
    -- Timestamp da atividade
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_document ON activity_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_municipality ON activity_logs(municipality_code);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- Índice composto para consultas de dashboard (tipo + município + data)
CREATE INDEX IF NOT EXISTS idx_activity_logs_dashboard 
ON activity_logs(activity_type, municipality_code, created_at);

-- Comentário da tabela
COMMENT ON TABLE activity_logs IS 'Logs de atividades do sistema (visualizações, downloads, uploads, etc.)';
COMMENT ON COLUMN activity_logs.activity_type IS 'Tipo: view, download, upload, edit, delete';
COMMENT ON COLUMN activity_logs.metadata IS 'Dados extras em JSON: file_name, file_size, etc.';

-- ============================================
-- VERIFICAÇÃO
-- ============================================

SELECT '✅ Tabela activity_logs criada com sucesso!' as status;

-- Contar registros (deve retornar 0 inicialmente)
SELECT COUNT(*) as total_activities FROM activity_logs;
