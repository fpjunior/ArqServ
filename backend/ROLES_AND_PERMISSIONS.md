# Sistema de Roles e Permissões - ArqServ

## Estrutura de Autenticação e Autorização com Supabase

### 🎯 Visão Geral

Sistema integrado de autenticação e autorização baseado em **roles** e **permissões** usando Supabase PostgreSQL.

### 📋 Roles Disponíveis

1. **admin** - Acesso total ao sistema
2. **user** - Acesso limitado (leitura e uploads básicos)
3. **manager** - Acesso intermediário (criação e edição de recursos)

### 🔐 Como Funciona

#### 1. **Criação de Usuário no Supabase**

Insira um novo usuário na tabela `users`:

```sql
INSERT INTO users (name, email, password, user_type, role, municipality, is_active)
VALUES (
  'João Silva',
  'joao@email.com',
  '$2a$10$...', -- senha com hash bcrypt
  'prefeitura',
  'admin',      -- role: admin, user, ou manager
  'São Paulo',
  true          -- is_active
);
```

#### 2. **Login**

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "password": "senha123"
}
```

**Resposta:**
```json
{
  "status": "SUCCESS",
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "joao@email.com",
      "name": "João Silva",
      "role": "admin",
      "user_type": "prefeitura",
      "municipality": "São Paulo"
    }
  }
}
```

#### 3. **Token JWT com Permissões**

O token contém:
- `id`, `email`, `name`
- `role` (admin, user, manager)
- `permissions` (array de permissões)
- `user_type` e `municipality`

### 🛡️ Middlewares de Autenticação

#### Verificar Autenticação

```javascript
router.get('/dados-protegidos', authenticate, (req, res) => {
  // req.user contém os dados do usuário autenticado
});
```

#### Verificar se é Admin

```javascript
router.delete('/usuarios/:id', authenticate, requireAdmin, (req, res) => {
  // Apenas admins podem acessar
});
```

#### Verificar Permissão Específica

```javascript
router.post('/servidores', authenticate, requirePermission('servers.create'), (req, res) => {
  // Apenas usuários com permissão 'servers.create' podem acessar
});
```

### 📊 Tabelas Supabase

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  user_type VARCHAR(20),
  municipality VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `roles`
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `role_permissions`
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, permission)
);
```

### 🎮 API Admin

#### Listar Todos os Usuários
```bash
GET /api/admin/users
Authorization: Bearer <token_admin>
```

#### Atualizar Role do Usuário
```bash
PATCH /api/admin/users/{userId}/role
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "role": "admin"  // ou "user", "manager"
}
```

#### Ativar/Desativar Usuário
```bash
PATCH /api/admin/users/{userId}/toggle-active
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "is_active": true
}
```

#### Listar Roles
```bash
GET /api/admin/roles
Authorization: Bearer <token_admin>
```

#### Listar Permissões de um Role
```bash
GET /api/admin/roles/{role}/permissions
Authorization: Bearer <token_admin>
```

### 📝 Permissões Padrão

**ADMIN** tem acesso a:
- `users.*` (create, read, update, delete)
- `servers.*` (create, read, update, delete)
- `documents.*` (create, read, update, delete)
- `settings.manage`

**USER** tem acesso a:
- `users.read`
- `servers.read`
- `documents.read`
- `documents.upload`

**MANAGER** tem acesso a:
- `users.read`, `users.update`
- `servers.create`, `servers.read`, `servers.update`
- `documents.create`, `documents.read`, `documents.update`

### 🚀 Setup Inicial

1. **Execute o script SQL no Supabase:**
   ```bash
   # Acesse Supabase Dashboard > SQL Editor
   # Cole o conteúdo de backend/init-roles.sql
   # Execute
   ```

2. **Teste o Login:**
   ```bash
   curl -X POST http://localhost:3005/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@email.com","password":"senha123"}'
   ```

3. **Use o Token em Requisições Protegidas:**
   ```bash
   curl -X GET http://localhost:3005/api/admin/users \
     -H "Authorization: Bearer eyJhbGc..."
   ```

### 🔄 Fluxo de Autenticação

```
1. Usuário faz Login (email + senha)
   ↓
2. Backend verifica credenciais no Supabase
   ↓
3. Se válido, gera JWT com role + permissions
   ↓
4. Usuário usa token em requests posteriores
   ↓
5. Middleware authenticate valida token e carrega usuário
   ↓
6. Middlewares como requireAdmin verificam acesso
   ↓
7. Se autorizado, endpoint processa request
```

### ✅ Checklist de Implementação

- [x] Tabelas de roles e permissions no Supabase
- [x] Middleware de autenticação
- [x] Middleware de autorização (admin check)
- [x] Middleware de permissões específicas
- [x] API de gerenciamento de usuários (admin)
- [x] API de atualização de roles
- [x] Geração de JWT com permissões
- [ ] Frontend: Adicionar verificação de roles antes de renderizar componentes
- [ ] Frontend: Mostrar/esconder botões baseado em role do usuário

### 🐛 Troubleshooting

**Problema:** Usuário não consegue fazer login
- Verificar se `is_active = true`
- Verificar se senha está com hash bcrypt
- Verificar se email existe na tabela

**Problema:** Token inválido
- Verificar se `JWT_SECRET` é o mesmo no `.env`
- Verificar se token não expirou (24h)

**Problema:** Acesso negado em endpoint admin
- Verificar se usuário tem `role = 'admin'`
- Verificar token no Authorization header
