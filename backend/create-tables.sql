-- Criar tabelas para sistema de documentos ArqServ
-- Execute no SQL Editor do Supabase

-- Tabela de municípios
CREATE TABLE IF NOT EXISTS municipalities (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    drive_folder_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de servidores
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    municipality_code VARCHAR(20) NOT NULL,
    drive_folder_id VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (municipality_code) REFERENCES municipalities(code)
);

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'geral',
    municipality_code VARCHAR(20) NOT NULL,
    server_id INTEGER,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    google_drive_id VARCHAR(255),
    uploaded_by INTEGER,
    -- Campos para documentação financeira
    document_type VARCHAR(20) DEFAULT 'servidor',
    financial_document_type VARCHAR(100), -- balanco, orcamento, prestacao-contas, etc.
    financial_year INTEGER,
    financial_period VARCHAR(20), -- 1, 2, 3, 4, semestral-1, semestral-2
    hierarchical_path TEXT, -- Caminho completo da estrutura de pastas
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (municipality_code) REFERENCES municipalities(code),
    FOREIGN KEY (server_id) REFERENCES servers(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Inserir municípios de exemplo
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
INSERT INTO servers (name, municipality_code, description) VALUES
-- Aliança
('Ana Silva Santos', '2600500', 'Servidor público municipal'),
('João Carlos Oliveira', '2600500', 'Servidor público municipal'),
('Carlos Eduardo Ramos', '2600500', 'Servidor público municipal'),

-- Amaraji  
('Maria Fernanda Lima', '2600609', 'Servidor público municipal'),
('Pedro Henrique Costa', '2600609', 'Servidor público municipal'),
('Beatriz Almeida Souza', '2600609', 'Servidor público municipal'),

-- Araçoiaba
('Juliana Pereira Souza', '2600708', 'Servidor público municipal'),
('Fernando Dias Machado', '2600708', 'Servidor público municipal'),
('Camila Rodrigues Lopes', '2600708', 'Servidor público municipal'),

-- Condado
('Roberto da Silva Junior', '2604106', 'Servidor público municipal'),
('Carla Mendes Alves', '2604106', 'Servidor público municipal'),
('Miguel Santos Barbosa', '2604106', 'Servidor público municipal')
ON CONFLICT DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_municipality ON documents(municipality_code);
CREATE INDEX IF NOT EXISTS idx_documents_server ON documents(server_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_servers_municipality ON servers(municipality_code);

-- Comentários das tabelas
COMMENT ON TABLE municipalities IS 'Municípios cadastrados no sistema';
COMMENT ON TABLE servers IS 'Servidores públicos dos municípios';
COMMENT ON TABLE documents IS 'Documentos digitalizados armazenados no Google Drive';

-- Verificar criação das tabelas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('municipalities', 'servers', 'documents')
ORDER BY table_name, ordinal_position;