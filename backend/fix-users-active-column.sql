-- ============================================
-- SCRIPT PARA VERIFICAR/CORRIGIR COLUNA ACTIVE NA TABELA USERS
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Verificar estrutura atual da tabela users
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Adicionar coluna 'active' se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'active'
    ) THEN
        ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Coluna active adicionada na tabela users';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna active já existe na tabela users';
    END IF;
END $$;

-- 3. Garantir que todos os usuários existentes tenham active = true (se NULL)
UPDATE users SET active = true WHERE active IS NULL;

-- 4. Criar índice para performance em consultas por status ativo
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- 5. Verificar resultado
SELECT id, name, email, role, active, created_at 
FROM users 
ORDER BY created_at DESC;
