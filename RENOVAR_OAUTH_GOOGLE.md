# 🔐 Renovar Credenciais OAuth do Google Drive

## ⚠️ Problema Atual
As credenciais OAuth (`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`) estão **inválidas ou revogadas**.

Erro: `invalid_client`

---

## 📋 Solução: Criar Novas Credenciais OAuth

### Passo 1: Acessar Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google
3. Selecione seu projeto (ou crie um novo se necessário)

### Passo 2: Ativar Google Drive API

1. No menu lateral, vá em **"APIs & Services"** > **"Library"**
2. Procure por **"Google Drive API"**
3. Clique em **"Enable"** (se ainda não estiver ativada)

### Passo 3: Criar Credenciais OAuth 2.0

1. Vá em **"APIs & Services"** > **"Credentials"**
2. Clique em **"+ CREATE CREDENTIALS"**
3. Selecione **"OAuth client ID"**

### Passo 4: Configurar OAuth Consent Screen (se necessário)

Se aparecer uma mensagem para configurar, faça:

1. Clique em **"CONFIGURE CONSENT SCREEN"**
2. Selecione **"External"** (ou Internal se for Google Workspace)
3. Preencha:
   - **App name:** ArqServ
   - **User support email:** seu-email@gmail.com
   - **Developer contact:** seu-email@gmail.com
4. Clique **"SAVE AND CONTINUE"**
5. Em **Scopes**, clique **"ADD OR REMOVE SCOPES"**
6. Adicione: `https://www.googleapis.com/auth/drive.file`
7. Clique **"SAVE AND CONTINUE"**
8. Em **Test users**, adicione seu email
9. Clique **"SAVE AND CONTINUE"**

### Passo 5: Criar OAuth Client ID

1. Volte para **"Credentials"** > **"+ CREATE CREDENTIALS"** > **"OAuth client ID"**
2. **Application type:** Web application
3. **Name:** ArqServ Backend
4. **Authorized redirect URIs:** Adicione:
   ```
   http://localhost:3005/auth/google/callback
   ```
5. Clique **"CREATE"**

### Passo 6: Copiar Credenciais

Você verá uma tela com:
- **Client ID** (ex: `123456789-abc...xyz.apps.googleusercontent.com`)
- **Client Secret** (ex: `GOCSPX-...`)

**COPIE AMBOS!**

---

## 🔧 Atualizar .env

Edite o arquivo `ArqServ/backend/.env`:

```env
GOOGLE_CLIENT_ID=COLE_O_CLIENT_ID_AQUI
GOOGLE_CLIENT_SECRET=COLE_O_CLIENT_SECRET_AQUI
GOOGLE_REFRESH_TOKEN=deixe_vazio_por_enquanto
GOOGLE_DRIVE_ROOT_FOLDER_ID=1swo92v1_TeQVuZ4bUx9Xlv3dWwaKSCbc
```

---

## 🔄 Gerar Novo Refresh Token

Depois de atualizar o `.env`:

```powershell
cd "c:\ws\projetos kralinfo\ArqServ\backend"
node generate-refresh-token.js
```

1. Abra a URL que aparecer
2. Faça login e autorize
3. Copie o **código** da URL de retorno
4. Cole no terminal
5. Copie o **GOOGLE_REFRESH_TOKEN** gerado
6. Cole no `.env`

---

## 🐳 Reiniciar Docker

```powershell
cd "c:\ws\projetos kralinfo\ArqServ"
docker-compose down
docker-compose up -d
```

Verifique os logs:
```powershell
docker logs arqserv_backend --tail 20
```

Você deve ver:
```
✅ Connected to Google Drive as: seu-email@gmail.com
✅ Google Drive OAuth service initialized successfully
```

---

## 📁 Testar Upload

Acesse o frontend e tente fazer upload de um documento. O arquivo deve ir direto para o Google Drive!

---

## 🆘 Problemas?

### "invalid_client" persiste
- Verifique se copiou o Client ID e Secret corretamente
- Certifique-se de que salvou o `.env`
- Reinicie o Docker completamente

### "redirect_uri_mismatch"
- Adicione `http://localhost:3005/auth/google/callback` nas Authorized URIs
- Exatamente como está, sem espaços ou barras extras

### "access_denied"
- Adicione seu email nos Test Users do OAuth Consent Screen
- Publique o app (modo Production) se necessário

---

## ✅ Checklist

- [ ] Google Drive API ativada
- [ ] OAuth Consent Screen configurado
- [ ] OAuth Client ID criado
- [ ] Redirect URI adicionado: `http://localhost:3005/auth/google/callback`
- [ ] Client ID e Secret copiados para `.env`
- [ ] Refresh Token gerado com `generate-refresh-token.js`
- [ ] Docker reiniciado
- [ ] Logs mostram conexão com Google Drive
