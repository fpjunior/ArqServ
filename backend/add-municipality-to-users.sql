-- ============================================
-- ADICIONAR CAMPO MUNICÍPIO À TABELA USERS
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar coluna municipality_code na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS municipality_code VARCHAR(20) NULL;

-- 2. Criar foreign key com municipalities
-- (Se a constraint já existir, será ignorada)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE users 
        ADD CONSTRAINT fk_users_municipality 
        FOREIGN KEY (municipality_code) 
        REFERENCES municipalities(code)
        ON DELETE SET NULL;
    EXCEPTION 
        WHEN duplicate_object THEN 
        RAISE NOTICE 'Foreign key fk_users_municipality já existe';
    END;
END $$;

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_users_municipality_code ON users(municipality_code);

-- 4. Adicionar comentários para documentação
COMMENT ON COLUMN users.municipality_code IS 'Código do município ao qual o usuário tem acesso (para usuários tipo "user")';

-- ============================================
-- VERIFICAÇÕES
-- ============================================

-- Verificar se a coluna foi criada
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name = 'municipality_code';

-- Verificar foreign key
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
WHERE tc.table_name = 'users' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'municipality_code';

-- Verificar índices
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'users' 
    AND indexname LIKE '%municipality%';

-- Verificar estrutura atualizada da tabela users
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- ============================================
-- REGRAS DE NEGÓCIO
-- ============================================
-- 
-- 1. Campo municipality_code:
--    - Obrigatório APENAS para usuários com role = 'user'
--    - Pode ser NULL para admins (eles acessam todos os municípios)
--    - Referencia municipalities.code
--
-- 2. Controle de acesso:
--    - Admin: municipality_code = NULL → acessa todos os municípios
--    - User: municipality_code = 'codigo' → acessa apenas esse município
--
-- 3. No frontend:
--    - Dropdown de município só aparece quando role = 'user'
--    - Admin não precisa selecionar município
--