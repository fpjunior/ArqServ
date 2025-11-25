-- Criar tabela de roles se não existir
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de permissões
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_role FOREIGN KEY (role) REFERENCES roles(name) ON DELETE CASCADE,
  UNIQUE(role, permission)
);

-- Inserir roles padrão
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrador do sistema com acesso total'),
  ('user', 'Usuário comum com acesso limitado'),
  ('manager', 'Gerenciador com permissões intermediárias')
ON CONFLICT (name) DO NOTHING;

-- Inserir permissões para ADMIN
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'users.create'),
  ('admin', 'users.read'),
  ('admin', 'users.update'),
  ('admin', 'users.delete'),
  ('admin', 'servers.create'),
  ('admin', 'servers.read'),
  ('admin', 'servers.update'),
  ('admin', 'servers.delete'),
  ('admin', 'documents.create'),
  ('admin', 'documents.read'),
  ('admin', 'documents.update'),
  ('admin', 'documents.delete'),
  ('admin', 'settings.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- Inserir permissões para USER
INSERT INTO role_permissions (role, permission) VALUES
  ('user', 'users.read'),
  ('user', 'servers.read'),
  ('user', 'documents.read'),
  ('user', 'documents.upload')
ON CONFLICT (role, permission) DO NOTHING;

-- Inserir permissões para MANAGER
INSERT INTO role_permissions (role, permission) VALUES
  ('manager', 'users.read'),
  ('manager', 'users.update'),
  ('manager', 'servers.create'),
  ('manager', 'servers.read'),
  ('manager', 'servers.update'),
  ('manager', 'documents.create'),
  ('manager', 'documents.read'),
  ('manager', 'documents.update')
ON CONFLICT (role, permission) DO NOTHING;

-- Atualizar coluna de usuários existentes (se necessário)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
