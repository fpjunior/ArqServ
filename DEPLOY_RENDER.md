# Guia de Deploy no Render.com - HOSPEDAGEM GRATUITA

## 💰 Custo: $0 - $7/mês

### Plano de Deploy:
- **Frontend**: Grátis (Static Site)
- **Backend**: Grátis (750h/mês - suficiente para 1 aplicação)
- **PostgreSQL**: Grátis por 90 dias, depois $7/mês
- **Domínio**: Subdomínio grátis (.onrender.com)

## 🚀 Passo a Passo:

### 1. Preparar o Código
```bash
# O código já está pronto! Só ajustar URLs de produção
```

### 2. Criar conta no Render.com
- Acesse: https://render.com
- Conecte com sua conta GitHub
- Autorize acesso ao repositório ArqServ

### 3. Deploy do Banco (PostgreSQL)
- New > PostgreSQL
- Name: `arqserv-postgres`
- Database: `arqserv_db`  
- User: `arqserv_user`
- Plan: Free (90 dias)

### 4. Deploy do Backend
- New > Web Service
- Connect Repository: ArqServ
- Name: `arqserv-backend`
- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Plan: Free

**Variáveis de Ambiente:**
```
NODE_ENV=production
PORT=10000
DB_HOST=[copiar do PostgreSQL criado]
DB_PORT=5432
DB_NAME=arqserv_db
DB_USER=arqserv_user
DB_PASSWORD=[copiar do PostgreSQL criado]
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
```

### 5. Deploy do Frontend
- New > Static Site
- Connect Repository: ArqServ
- Name: `arqserv-frontend`
- Root Directory: `frontend`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist/arqserv-frontend`

### 6. Configurar CORS
Atualizar backend para aceitar o domínio do frontend:
- Adicionar URL do frontend nas variáveis: `CORS_ORIGIN=https://arqserv-frontend.onrender.com`

## 📋 URLs Finais:
- **Frontend**: https://arqserv-frontend.onrender.com
- **Backend**: https://arqserv-backend.onrender.com
- **Admin DB**: Via Render Dashboard

## ⚠️ Limitações do Plano Gratuito:
- Backend "dorme" após 15min sem uso (demora ~30s para "acordar")
- PostgreSQL grátis por apenas 90 dias
- Largura de banda limitada
- Sem domínio personalizado

## 💡 Otimizações para Produção:
- Comprimir assets do frontend
- Implementar cache no backend
- Otimizar queries do PostgreSQL
- Monitorar uso de recursos

## 🔄 Alternativa Ultra-Barata:
Se após 90 dias não quiser pagar $7/mês pelo PostgreSQL:
1. Migrar para Supabase (PostgreSQL grátis)
2. Ou usar SQLite (grátis, mas limitado)
3. Ou VPS de $3/mês (Contabo, Hetzner)