-- ============================================
-- SCRIPT COMPLETO DE CONFIGURAÇÃO DO BANCO DE DADOS
-- Sistema ArqServ - Gestão de Documentos
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. TABELA DE MUNICÍPIOS
-- ============================================

CREATE TABLE IF NOT EXISTS municipalities (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    drive_folder_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para municipalities
CREATE INDEX IF NOT EXISTS idx_municipalities_code ON municipalities(code);
CREATE INDEX IF NOT EXISTS idx_municipalities_state ON municipalities(state);

-- ============================================
-- 2. TABELA DE SERVIDORES
-- ============================================

CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    municipality_code VARCHAR(20),
    drive_folder_id VARCHAR(255),
    description TEXT,
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar colunas se não existirem
DO $$ 
BEGIN
    -- Adicionar is_active se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'servers' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE servers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Adicionar drive_folder_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'servers' AND column_name = 'drive_folder_id'
    ) THEN
        ALTER TABLE servers ADD COLUMN drive_folder_id VARCHAR(255);
    END IF;
END $$;

-- Índices para servers
CREATE INDEX IF NOT EXISTS idx_servers_municipality_code ON servers(municipality_code);
CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name);
CREATE INDEX IF NOT EXISTS idx_servers_is_active ON servers(is_active);

-- ============================================
-- 3. TABELA DE USUÁRIOS (se não existir)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- 4. TABELA DE DOCUMENTOS
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'geral',
    municipality_code VARCHAR(20),
    server_id INTEGER,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    google_drive_id VARCHAR(255),
    uploaded_by INTEGER,
    -- Campos para documentação financeira
    document_type VARCHAR(20) DEFAULT 'servidor',
    financial_document_type VARCHAR(100),
    financial_year INTEGER,
    financial_period VARCHAR(20),
    hierarchical_path TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Foreign keys para documents (opcionais)
-- Descomente se quiser forçar integridade referencial
-- ALTER TABLE documents ADD CONSTRAINT fk_documents_municipality 
-- FOREIGN KEY (municipality_code) REFERENCES municipalities(code) ON DELETE CASCADE;

-- ALTER TABLE documents ADD CONSTRAINT fk_documents_server 
-- FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE;

-- ALTER TABLE documents ADD CONSTRAINT fk_documents_user 
-- FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- Índices para documents
CREATE INDEX IF NOT EXISTS idx_documents_municipality ON documents(municipality_code);
CREATE INDEX IF NOT EXISTS idx_documents_server ON documents(server_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- ============================================
-- 5. FUNÇÕES DE ATUALIZAÇÃO AUTOMÁTICA
-- ============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualização automática de updated_at
DROP TRIGGER IF EXISTS trigger_municipalities_updated_at ON municipalities;
CREATE TRIGGER trigger_municipalities_updated_at
    BEFORE UPDATE ON municipalities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_servers_updated_at ON servers;
CREATE TRIGGER trigger_servers_updated_at
    BEFORE UPDATE ON servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;
CREATE TRIGGER trigger_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. DADOS DE EXEMPLO (OPCIONAL)
-- ============================================

-- Inserir municípios de exemplo (Pernambuco)
INSERT INTO municipalities (code, name, state) VALUES
('2600500', 'Aliança', 'PE'),
('2600609', 'Amaraji', 'PE'),
('2600708', 'Araçoiaba', 'PE'),
('2604106', 'Condado', 'PE'),
('2611101', 'Palmares', 'PE'),
('2615607', 'Vertente', 'PE'),
('2607307', 'Ingazeira', 'PE'),
('2609907', 'Nabuco', 'PE')
ON CONFLICT (code) DO NOTHING;

-- Inserir alguns servidores de exemplo
INSERT INTO servers (name, municipality_code, description, department) VALUES
-- Aliança
('Ana Silva Santos', '2600500', 'Servidor público municipal', 'Administração'),
('João Carlos Oliveira', '2600500', 'Servidor público municipal', 'Educação'),
('Carlos Eduardo Ramos', '2600500', 'Servidor público municipal', 'Saúde'),

-- Amaraji  
('Maria Fernanda Lima', '2600609', 'Servidor público municipal', 'Finanças'),
('Pedro Henrique Costa', '2600609', 'Servidor público municipal', 'Obras'),
('Beatriz Almeida Souza', '2600609', 'Servidor público municipal', 'Cultura'),

-- Araçoiaba
('Juliana Pereira Souza', '2600708', 'Servidor público municipal', 'Educação'),
('Fernando Dias Machado', '2600708', 'Servidor público municipal', 'Saúde'),
('Camila Rodrigues Lopes', '2600708', 'Servidor público municipal', 'Administração')
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. PERMISSÕES E POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS nas tabelas (opcional, dependendo da sua estratégia de segurança)
-- ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso (exemplo básico)
-- Ajuste conforme suas necessidades de segurança

-- Política para leitura pública de municípios
-- CREATE POLICY "Permitir leitura pública de municípios"
-- ON municipalities FOR SELECT
-- USING (true);

-- Política para leitura pública de servidores
-- CREATE POLICY "Permitir leitura pública de servidores"
-- ON servers FOR SELECT
-- USING (true);

-- ============================================
-- 8. VERIFICAÇÕES E CONSULTAS ÚTEIS
-- ============================================

-- Contar registros em cada tabela
SELECT 'municipalities' as tabela, COUNT(*) as total FROM municipalities
UNION ALL
SELECT 'servers' as tabela, COUNT(*) as total FROM servers
UNION ALL
SELECT 'documents' as tabela, COUNT(*) as total FROM documents
UNION ALL
SELECT 'users' as tabela, COUNT(*) as total FROM users;

-- ============================================
-- 9. COMENTÁRIOS DAS TABELAS
-- ============================================

COMMENT ON TABLE municipalities IS 'Municípios cadastrados no sistema';
COMMENT ON TABLE servers IS 'Servidores públicos dos municípios';
COMMENT ON TABLE documents IS 'Documentos digitalizados armazenados no Google Drive';
COMMENT ON TABLE users IS 'Usuários do sistema';

-- ============================================
-- SCRIPT FINALIZADO
-- ============================================

SELECT '✅ Banco de dados configurado com sucesso!' as status;
