# 🚀 Instruções de Desenvolvimento - ArqServ

## 📁 Estrutura do Projeto

```
ArqServ/
├── frontend/          # Aplicação Angular (Pronta)
├── backend/           # API Node.js (A fazer)
├── package.json       # Scripts principais
└── README.md          # Documentação geral
```

## 🛠️ Scripts Principais

### Na raiz do projeto:

```bash
# Instalar dependências de ambos os projetos
npm run install:all

# Executar apenas o frontend
npm run start:frontend

# Executar apenas o backend (quando implementado)
npm run start:backend

# Executar frontend e backend simultaneamente
npm run dev

# Build de produção
npm run build
```

### Frontend individual:

```bash
cd frontend
npm install
npm start           # Desenvolvimento
npm run build       # Produção
npm test           # Testes
```

### Backend individual (futuro):

```bash
cd backend
npm install
npm run dev         # Desenvolvimento
npm start          # Produção
npm test           # Testes
```

## ✅ Status Atual

### ✅ Frontend (100% Funcional)
- ✅ Angular 19 configurado
- ✅ Sistema de autenticação
- ✅ Dashboard responsivo
- ✅ Componentes sem Angular Material
- ✅ Rotas protegidas
- ✅ Tailwind CSS

### 🚧 Backend (0% - A implementar)
- [ ] Configuração inicial do Express.js
- [ ] Sistema de autenticação JWT
- [ ] Integração Google Drive API
- [ ] CRUD de usuários
- [ ] Upload de arquivos
- [ ] Controle de permissões

## 🎯 Próximos Passos

1. **Implementar Backend:**
   ```bash
   cd backend
   npm init
   npm install express cors helmet morgan bcryptjs jsonwebtoken
   ```

2. **Estruturar API:**
   - Criar rotas de autenticação
   - Implementar middleware de segurança
   - Configurar banco de dados

3. **Integrar Google Drive:**
   - Configurar OAuth 2.0
   - Implementar upload/download

4. **Conectar Frontend ao Backend:**
   - Atualizar serviços Angular
   - Remover dados simulados
   - Testar integração

## 🔧 Desenvolvimento

### Para trabalhar no Frontend:
```bash
cd frontend
npm start
```
Acesse: http://localhost:4200

### Para trabalhar no Backend (futuro):
```bash
cd backend
npm run dev
```
API estará em: http://localhost:3000

## 📝 Notas Importantes

- Frontend está **100% funcional** com dados simulados
- Backend precisa ser criado do zero
- Usar as credenciais de teste para desenvolvimento
- Manter separação clara entre frontend e backend

---

**Happy Coding!** 🚀