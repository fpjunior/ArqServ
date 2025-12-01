-- ============================================
-- SCRIPT DE VERIFICAÇÃO DA ESTRUTURA DAS TABELAS
-- Execute este script no Supabase e me envie o resultado
-- ============================================

-- 1. Verificar estrutura da tabela municipalities
SELECT 
    'municipalities' as table_name,
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'municipalities' 
ORDER BY ordinal_position;

-- 2. Verificar estrutura da tabela servers
SELECT 
    'servers' as table_name,
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'servers' 
ORDER BY ordinal_position;

-- 3. Verificar estrutura da tabela documents
SELECT 
    'documents' as table_name,
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'documents' 
ORDER BY ordinal_position;

-- 4. Verificar estrutura da tabela users
SELECT 
    'users' as table_name,
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 5. Listar todas as tabelas existentes
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
