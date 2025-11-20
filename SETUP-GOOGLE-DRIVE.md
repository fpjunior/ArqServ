# 🚀 Setup Google Drive OAuth 2.0 - CREDENCIAIS COMPARTILHADAS

Este guia é para quem já trabalha no projeto e precisa configurar a nova funcionalidade de upload para Google Drive após fazer pull, **usando as credenciais OAuth já existentes**.

## 📋 Pré-requisitos
- Projeto já funcionando localmente com Docker
- Credenciais OAuth do Google Drive (já configuradas)

## ⚡ Setup Rápido (3 passos)

### 1. 🔄 Atualizar o código
```bash
git pull origin main
```

### 2. 📝 Configurar backend/.env
Copie o arquivo exemplo:
```bash
cp .env.example backend/.env
```

Edite `backend/.env` e adicione as **credenciais OAuth existentes**:
```env
# Suas configurações existentes (DB, JWT, etc.)
NODE_ENV=development
PORT=3005
DB_HOST=localhost
DB_PORT=5432
# ... outras configs que já tem ...

# Google Drive OAuth 2.0 - USE ESTAS CREDENCIAIS EXATAS:
GOOGLE_DRIVE_CLIENT_ID=1006764164537-l9fgj3hp0e327jk06q9njo1s20mt2o9c.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=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
GOOGLE_DRIVE_REFRESH_TOKEN=1//04VVVY8ACxzF3CgYIARAAGAQSNwF-L9IrfPptcQrxPpLSlE7RoEMQzIZG8wrfYdYvQwvKGjrVBrFhVYnBU5xy3zGDEQkcH8g8Xrc
```

### 3. 🐳 Reiniciar containers
```bash
docker-compose down
docker-compose up --build
```

## ✅ Verificação

### 1. 🔍 Verificar logs do backend
```bash
docker-compose logs backend
```

**✅ Se estiver funcionando, verá:**
```
✅ Google Drive OAuth service initialized successfully
Connected to Google Drive as: kralinfo18@gmail.com
```

### 2. 🧪 Testar upload
Faça login no frontend e teste um upload, **OU** teste via API:
```bash
curl -X POST http://localhost:3005/upload \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -F "file=@teste.pdf" \
  -F "municipalityId=1" \
  -F "serverId=1" \
  -F "documentType=Certidão" \
  -F "description=Teste de upload"
```

**✅ Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Arquivo enviado com sucesso!",
  "data": {
    "googleDriveId": "1abc123def456...",
    "googleDriveUrl": "https://drive.google.com/file/d/..."
  }
}
```

---

## 🚨 Se Der Problema

### ❌ "OAuth service failed to initialize"
1. Verifique se copiou **EXATAMENTE** as 3 credenciais no `.env`
2. Reinicie os containers: `docker-compose restart`
3. Verifique os logs: `docker-compose logs backend`

### ❌ Containers não sobem
1. Verifique se o Docker está rodando
2. Pare tudo: `docker-compose down`
3. Suba novamente: `docker-compose up --build`

### ❌ Upload não funciona
1. Confirme que está logado no sistema
2. Verifique se o token JWT é válido
3. Teste com um arquivo pequeno primeiro

## 💡 Dicas
- ✅ O sistema salva no Google Drive da conta **kralinfo18@gmail.com**
- ✅ Cria automaticamente a estrutura: Município > Letra > Servidor
- ✅ Funciona com **uploads ilimitados** (OAuth 2.0)
- ✅ Todos os arquivos ficam organizados por hierarquia

## 📞 Precisa de Ajuda?
Se algo não funcionar, mande print dos logs:
```bash
docker-compose logs backend
```