-- Promover usuário específico para superadmin
-- Email: brenohdias123@gmail.com

UPDATE users 
SET role = 'superadmin', 
    updated_at = NOW()
WHERE email = 'brenohdias123@gmail.com';

-- Verificar a atualização
SELECT id, name, email, role, active 
FROM users 
WHERE email = 'brenohdias123@gmail.com';
