-- ============================================
-- TABELA SERVERS - ESTRUTURA ATUALIZADA
-- ============================================
-- Esta é a estrutura atual da tabela servers
-- com suporte a múltiplos servidores por município

-- 1. Dropar tabela existente se necessário (CUIDADO: apaga todos os dados)
-- DROP TABLE IF EXISTS servers CASCADE;

-- 2. Criar tabela servers
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    municipality_code VARCHAR(7) NOT NULL,  -- Código IBGE do município (7 dígitos)
    department VARCHAR(255),
    drive_folder_id VARCHAR(255),           -- ID da pasta no Google Drive
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Criar foreign key com municipalities
ALTER TABLE servers 
ADD CONSTRAINT fk_servers_municipality 
FOREIGN KEY (municipality_code) 
REFERENCES municipalities(code)
ON DELETE CASCADE;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_servers_municipality_code ON servers(municipality_code);
CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name);
CREATE INDEX IF NOT EXISTS idx_servers_active ON servers(active);

-- 5. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_servers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_servers_updated_at ON servers;
CREATE TRIGGER trigger_servers_updated_at
    BEFORE UPDATE ON servers
    FOR EACH ROW
    EXECUTE FUNCTION update_servers_updated_at();

-- ============================================
-- DADOS DE EXEMPLO
-- ============================================

-- Inserir servidores de teste para Aliança (PE)
INSERT INTO servers (name, municipality_code, description, department) VALUES
('Ana Paula Silva Santos', '2600500', 'Servidor público municipal', 'Administração'),
('João Carlos Oliveira Lima', '2600500', 'Servidor público municipal', 'Educação'),
('Maria Fernanda Costa Souza', '2600500', 'Servidor público municipal', 'Saúde'),
('Carlos Eduardo Ramos Alves', '2600500', 'Servidor público municipal', 'Obras'),
('Juliana Pereira Mendes', '2600500', 'Servidor público municipal', 'Finanças'),
('Fernando Dias Machado', '2600500', 'Servidor público municipal', 'Assistência Social'),
('Camila Rodrigues Lopes', '2600500', 'Servidor público municipal', 'Educação'),
('Roberto da Silva Junior', '2600500', 'Servidor público municipal', 'Saúde'),
('Carla Mendes Alves', '2600500', 'Servidor público municipal', 'Cultura'),
('Miguel Santos Barbosa', '2600500', 'Servidor público municipal', 'Esportes')
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICAÇÕES
-- ============================================

-- Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'servers' 
ORDER BY ordinal_position;

-- Verificar foreign keys
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'servers' 
    AND tc.constraint_type = 'FOREIGN KEY';

-- Verificar índices
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'servers';

-- Contar servidores por município
SELECT 
    m.name as municipio,
    m.code as codigo,
    COUNT(s.id) as total_servidores
FROM municipalities m
LEFT JOIN servers s ON s.municipality_code = m.code
GROUP BY m.code, m.name
HAVING COUNT(s.id) > 0
ORDER BY COUNT(s.id) DESC, m.name;

-- Listar servidores de Aliança
SELECT 
    s.id,
    s.name,
    s.department,
    s.municipality_code,
    m.name as municipio,
    s.active,
    s.created_at
FROM servers s
JOIN municipalities m ON s.municipality_code = m.code
WHERE s.municipality_code = '2600500'
ORDER BY s.name;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Campo municipality_code:
--    - Armazena código IBGE do município (7 dígitos)
--    - Permite múltiplos servidores por município
--    - Possui foreign key para municipalities(code)
--    - Exemplo: '2600500' (Aliança/PE)
--
-- 2. Campo drive_folder_id:
--    - Armazena ID da pasta do servidor no Google Drive
--    - Usado para organização de documentos por servidor
--
-- 3. Soft Delete:
--    - A tabela NÃO usa soft delete (deleted_at)
--    - Deletar servidor remove permanentemente
--    - Use active = FALSE para desativar sem deletar
--
-- 4. Índices criados:
--    - idx_servers_municipality_code: Busca rápida por município
--    - idx_servers_name: Busca rápida por nome
--    - idx_servers_active: Filtro por servidores ativos
--
-- 5. Trigger updated_at:
--    - Atualiza automaticamente o timestamp em qualquer UPDATE
--
