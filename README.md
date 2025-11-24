# ArqServ - Sistema de Arquivo de Servidores

Sistema web para gerenciamento de documentos digitalizados de servidores públicos de diferentes prefeituras.

## 📋 Descrição

O ArqServ é uma plataforma que funciona como interface inteligente para organizar e disponibilizar documentos digitalizados armazenados em Google Drive, oferecendo:

- **Navegação amigável** por documentos organizados por servidor
- **Controle de acesso** por município
- **Upload seguro** de documentos (exclusivo para empresa de digitalização)
- **Visualização e download** de arquivos para prefeituras
- **Autenticação com Google OAuth 2.0** para acesso ao Drive

## 🏗️ Arquitetura

- **Frontend**: Angular 19 com Tailwind CSS
- **Backend**: Node.js + Express (em desenvolvimento)
- **Armazenamento**: Google Drive (por prefeitura)
- **Autenticação**: JWT + Google OAuth 2.0

## 👥 Perfis de Usuario

### Prefeitura (Cliente)
- Visualiza apenas documentos do próprio município
- Pode baixar e visualizar arquivos
- Não pode fazer upload de documentos

### Empresa de Digitalização (Interno)
- Acessa documentos de todos os municípios
- Pode fazer upload de arquivos para qualquer prefeitura
- Gerencia o sistema

## � Estrutura do Projeto

```
ArqServ/
├── frontend/          # Aplicação Angular
│   ├── src/
│   ├── package.json
│   └── README.md
├── backend/           # API Node.js (em desenvolvimento)
│   └── README.md
└── README.md         # Este arquivo
```

## 🚀 Como Executar

### Frontend

```bash
cd frontend
npm install
npm start
```

Acesse: http://localhost:4200

### Backend

```bash
cd backend
# Em desenvolvimento
```

## 🔐 Credenciais de Teste

- **Empresa:** admin@arqserv.com / 123456
- **Prefeitura:** prefeitura@cidade.gov.br / 123456

## � Status do Desenvolvimento

### ✅ Frontend (Concluído)
- [x] Tela de login responsiva
- [x] Dashboard principal
- [x] Autenticação simulada
- [x] Guards de rota
- [x] Interface responsiva

### 🔄 Backend (Em Desenvolvimento)
- [ ] API REST com Node.js
- [ ] Autenticação JWT
- [ ] Integração Google Drive API
- [ ] CRUD de documentos
- [ ] Controle de permissões

### 🎯 Próximos Passos
1. Implementar backend Node.js
2. Integrar frontend com backend
3. Configurar Google Drive API
4. Deploy em produção

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

**Desenvolvido para gerenciamento eficiente de documentos públicos** 📁✨