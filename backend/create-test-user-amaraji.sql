-- ============================================
-- CRIAR USUÁRIO DE TESTE PARA AMARAJI
-- ============================================

-- Verificar se o usuário já existe
SELECT id, username, email, municipality_code FROM users WHERE username = 'amaraji_test';

-- Criar usuário de teste para Amaraji (senha: 123456)
INSERT INTO users (username, email, password_hash, municipality_code, role) VALUES
  ('amaraji_test', 'amaraji@test.com', '$2b$10$rZ.LIeKt7G6J9J8xKqJ5PeqZ5ZqK5K5K5K5K5K5K5K5K5K5K5K5K5K', '2600401', 'user')
ON CONFLICT (username) DO NOTHING;

-- Verificar se foi criado corretamente
SELECT 
  u.id,
  u.username,
  u.email,
  u.municipality_code,
  u.role,
  m.name as municipality_name
FROM users u
LEFT JOIN municipalities m ON u.municipality_code = m.code
WHERE u.username = 'amaraji_test';