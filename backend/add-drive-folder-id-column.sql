-- Adicionar coluna drive_folder_id na tabela servers se não existir
-- Execute este SQL no Supabase SQL Editor

-- Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'servers' 
        AND column_name = 'drive_folder_id'
    ) THEN
        -- Adicionar a coluna se não existir
        ALTER TABLE servers ADD COLUMN drive_folder_id VARCHAR(255);
        RAISE NOTICE 'Coluna drive_folder_id adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna drive_folder_id já existe.';
    END IF;
END $$;

-- Verificar estrutura da tabela servers
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'servers' 
ORDER BY ordinal_position;
