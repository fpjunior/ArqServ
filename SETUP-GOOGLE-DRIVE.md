# 🚀 Setup Google Drive OAuth 2.0

Este guia é para quem já trabalha no projeto e precisa configurar a nova funcionalidade de upload para Google Drive após fazer pull.

## 📋 Pré-requisitos
- Projeto já funcionando localmente com Docker
- Acesso ao Google Cloud Console
- Conta Google para configurar OAuth

## ⚙️ Configuração Passo a Passo

### 1. 🔄 Atualizar o código
```bash
git pull origin main
```

### 2. 📁 Configurar .env no backend
Copie o arquivo exemplo e configure:
```bash
cp .env.example backend/.env
```

### 3. 🔐 Configurar Google Drive OAuth 2.0

#### 3.1. Google Cloud Console
1. Acesse https://console.cloud.google.com/
2. Crie um novo projeto ou selecione existente
3. Ative a **Google Drive API**:
   - Vá em "APIs e serviços" > "Biblioteca"
   - Busque por "Google Drive API" 
   - Clique em "Ativar"

#### 3.2. Configurar OAuth 2.0
1. Vá em "APIs e serviços" > "Credenciais"
2. Clique em "Criar credenciais" > "ID do cliente OAuth 2.0"
3. Configure a tela de consentimento OAuth:
   - Tipo: Externo
   - Nome do app: ArqServ (ou qualquer nome)
   - Email de suporte: seu email
   - Escopos: `https://www.googleapis.com/auth/drive.file`
4. Adicione seu email como "Usuário de teste"
5. Criar credenciais OAuth:
   - Tipo: Aplicação web
   - URIs de redirecionamento: `http://localhost:3005/auth/google/callback`

#### 3.3. Obter Refresh Token
1. Use este URL (substitua CLIENT_ID):
```
https://accounts.google.com/o/oauth2/auth?client_id=SEU_CLIENT_ID&redirect_uri=http://localhost:3005/auth/google/callback&scope=https://www.googleapis.com/auth/drive.file&response_type=code&access_type=offline&prompt=consent
```

2. Autorize o app e copie o código de autorização da URL

3. Troque o código por refresh token:
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=SEU_CLIENT_ID" \
  -d "client_secret=SEU_CLIENT_SECRET" \
  -d "code=CODIGO_DE_AUTORIZACAO" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:3005/auth/google/callback"
```

### 4. 📝 Configurar backend/.env
Edite `backend/.env` com suas credenciais:

```env
# Configurações existentes...
NODE_ENV=development
PORT=3005
DB_HOST=localhost
DB_PORT=5432
# ... outras configs ...

# Google Drive OAuth 2.0 (ADICIONAR)
GOOGLE_DRIVE_CLIENT_ID=seu_client_id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=seu_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=seu_refresh_token
```

### 5. 🐳 Reiniciar containers
```bash
docker-compose down
docker-compose up --build
```

### 6. ✅ Testar funcionamento
Verifique os logs do backend:
```bash
docker-compose logs backend
```

Deve aparecer:
```
✅ Google Drive OAuth service initialized successfully
Connected to Google Drive as: seu-email@gmail.com
```

### 7. 🧪 Testar upload
Use o frontend ou teste via API:
```bash
curl -X POST http://localhost:3005/upload \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -F "file=@teste.pdf" \
  -F "municipalityId=1" \
  -F "serverId=1" \
  -F "documentType=Certidão" \
  -F "description=Teste"
```

## 🚨 Problemas Comuns

### "OAuth service failed to initialize"
- Verifique se as variáveis de ambiente estão corretas
- Confirme que o refresh token está válido
- Verifique se a Google Drive API está ativada

### "Invalid refresh token"
- Gere um novo refresh token seguindo o passo 3.3
- Certifique-se de usar `access_type=offline` e `prompt=consent`

### "Quota exceeded"
- Isso não deve acontecer com OAuth 2.0
- Se acontecer, verifique se está usando as credenciais OAuth corretas

## 🔒 Segurança
- ❌ **NUNCA** commite o arquivo `.env`
- ❌ **NUNCA** exponha credenciais OAuth
- ✅ Use apenas as variáveis de ambiente
- ✅ Mantenha o `.env` no `.gitignore`

## 📞 Suporte
Se tiver problemas, verifique:
1. Logs do Docker: `docker-compose logs backend`
2. Variáveis de ambiente estão corretas
3. Google Drive API está ativada
4. Refresh token é válido