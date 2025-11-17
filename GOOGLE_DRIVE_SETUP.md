# Google Drive Setup for ArqServ

## 1. Criar projeto no Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Criar novo projeto: "ArqServ Documents"
3. Ativar Google Drive API:
   - Vá em "APIs & Services" > "Library"
   - Procure "Google Drive API" 
   - Clique "Enable"

## 2. Criar Service Account

1. Vá em "APIs & Services" > "Credentials"
2. Clique "Create Credentials" > "Service Account"
3. Nome: "arqserv-documents-service"
4. Clique "Create and Continue"
5. Role: "Editor" ou "Owner"
6. Clique "Done"

## 3. Gerar chave JSON

1. Clique na Service Account criada
2. Vá em "Keys" > "Add Key" > "Create new key"
3. Selecione "JSON" e baixe o arquivo
4. Renomeie para: `google-drive-credentials.json`

## 4. Configurar Google Drive

1. Criar pasta raiz no Google Drive: "ArqServ Documents"
2. Compartilhar com o email da Service Account (com permissão Editor)
3. Copiar ID da pasta (da URL: /folders/ID_AQUI)

## 5. Configurar no Render

Adicionar variável de ambiente:
```
GOOGLE_DRIVE_ROOT_FOLDER_ID=seu_folder_id_aqui
```

## 6. Estrutura de pastas será criada automaticamente:

```
ArqServ Documents/
├── Aliança/
│   ├── Servidores A/
│   │   ├── Ana Silva Santos/
│   │   └── André.../ 
│   ├── Servidores C/
│   │   └── Carlos Eduardo Ramos/
│   └── Servidores J/
│       └── João Carlos Oliveira/
└── Amaraji/
    ├── Servidores B/
    │   └── Beatriz Almeida Souza/
    ├── Servidores M/
    │   └── Maria Fernanda Lima/
    └── Servidores P/
        └── Pedro Henrique Costa/
```

## Credenciais de exemplo (NÃO usar em produção):
O arquivo google-drive-credentials.json deve ter este formato:

```json
{
  "type": "service_account",
  "project_id": "arqserv-documents",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "arqserv-service@arqserv-documents.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```