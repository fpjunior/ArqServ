# 🚀 Configuração do Google Drive - ArqServ

## ✅ Status Atual

Você já tem configurado:
- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_CLIENT_SECRET` 
- ✅ `GOOGLE_REFRESH_TOKEN`

## ⚠️ Falta Configurar

Apenas o **ID da pasta raiz** do Google Drive onde os documentos serão salvos.

---

## 📋 Passo a Passo

### 1️⃣ Criar Pasta no Google Drive

1. Acesse seu Google Drive (usando a conta que gerou o OAuth)
2. Crie uma pasta chamada **"ArqServ Documents"** (ou qualquer nome)
3. Abra a pasta
4. Copie o **ID da pasta** da URL

**Exemplo da URL:**
```
https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        Este é o ID da pasta
```

### 2️⃣ Adicionar ID no .env

Edite o arquivo `ArqServ/backend/.env` e adicione o ID copiado:

```env
GOOGLE_DRIVE_ROOT_FOLDER_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456
```

### 3️⃣ Reiniciar Backend

```powershell
cd "c:\ws\projetos kralinfo\ArqServ\backend"
npm start
```

---

## 🎯 Verificação

Após reiniciar, você deve ver no console:

```
✅ Connected to Google Drive as: seu-email@gmail.com
✅ Google Drive OAuth service initialized successfully
✅ Google Drive configurado - usando OAuth
```

Se ainda aparecer erro, verifique:
- [ ] O ID da pasta está correto
- [ ] A conta OAuth tem acesso à pasta
- [ ] O `GOOGLE_REFRESH_TOKEN` ainda é válido

---

## 📁 Estrutura de Pastas Automática

Após configurado, o sistema criará automaticamente:

```
ArqServ Documents/
├── Aliança/
│   ├── Ana Paula Silva Santos/
│   ├── João Carlos Oliveira Lima/
│   └── ...
├── Amaraji/
│   ├── Beatriz Cardoso Martins/
│   └── ...
└── [outros municípios]/
    └── [servidores]/
```

---

## 🔧 Comandos Úteis

### Verificar se Google Drive está funcionando
```powershell
# No console do backend, você verá logs como:
✅ Uploading to Google Drive: documento.pdf
📁 Creating folder: Município/Servidor
✅ File uploaded to Drive: file_id_123
```

### Testar upload manual
Use o endpoint do backend:
```http
POST http://localhost:3005/api/documents/upload
Content-Type: multipart/form-data

file: [arquivo.pdf]
municipality_code: 2600500
server_id: 1
document_type: contracheque
year: 2024
month: 11
```

---

## 🆘 Problemas Comuns

### Erro: "GOOGLE_DRIVE_ROOT_FOLDER_ID not configured"
**Solução:** Adicione o ID da pasta no arquivo `.env`

### Erro: "Invalid Credentials"
**Solução:** Gere um novo `GOOGLE_REFRESH_TOKEN` seguindo o guia OAuth

### Erro: "Insufficient Permission"
**Solução:** Verifique se a conta OAuth tem permissão de edição na pasta

---

## 📝 Notas

- O sistema usa **OAuth 2.0** (não Service Account)
- Os tokens são renovados automaticamente
- Uploads vão direto para o Google Drive
- Não há limite de armazenamento local
