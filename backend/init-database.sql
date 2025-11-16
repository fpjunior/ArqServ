-- ArqServ Database Initialization Script
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create documents table (for future use)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id),
    server_id VARCHAR(50),
    category VARCHAR(100),
    tags TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create servers table (for categorization)
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(50) UNIQUE,
    department VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial users with bcrypt hashed passwords
-- Password for all users: "123456"
INSERT INTO users (name, email, password, role) VALUES
    ('Administrador', 'admin@arqserv.com', '$2b$12$8da4psNjeoWPRENqUQ6KguZzRpYbOIehh0a2Px/eaX/st2ozael2q', 'admin'),
    ('Empresa Teste', 'empresa@test.com', '$2b$12$Kk1iFYa5abHw9Nut0DDmI.mybmCBQ1reP1otbKeTcEdtUY3ylCZGu', 'user'),
    ('Prefeitura SP', 'prefeitura@sp.gov.br', '$2b$12$4/SNkAkgyyRgcw78o72YRuNnzikEosEpnAhL3vmVVEIMvccE2.gR.', 'user'),
    ('Prefeitura RJ', 'prefeitura@rj.gov.br', '$2b$12$Wl.hSRD5yx84.92w64IbKeLC0VgrXej3f7.9FZaNUd5bDyv5jcqcC', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert initial servers
INSERT INTO servers (name, description, code, department) VALUES
    ('Arquivo Municipal SP', 'Arquivo de documentos da Prefeitura de São Paulo', 'SP-001', 'Administração'),
    ('Arquivo Estadual RJ', 'Arquivo de documentos do Estado do Rio de Janeiro', 'RJ-001', 'Governo'),
    ('Arquivo Federal', 'Arquivo Nacional de Documentos Federais', 'BR-001', 'Federal'),
    ('Arquivo Empresarial', 'Documentos de Empresas Privadas', 'EMP-001', 'Privado')
ON CONFLICT (code) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_documents_server_id ON documents(server_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_servers_code ON servers(code);

-- Verify the setup (execute this to see if everything worked)
SELECT 'Users created:' as info, COUNT(*) as count FROM users
UNION ALL
SELECT 'Servers created:' as info, COUNT(*) as count FROM servers;

-- Show sample users (passwords are all "123456")
SELECT 
    name,
    email,
    role,
    active,
    created_at
FROM users 
ORDER BY role DESC, name;