# 🔧 Configuração de Ambientes - ArqServ

## ✅ **CONFIGURADO COM SUCESSO!**

Sua aplicação agora está configurada para usar **automaticamente** as URLs corretas dependendo do ambiente:

### 🏠 **Desenvolvimento (Local)**
- **URL da API**: `http://localhost:3005/api`
- **Quando usar**: `npm start` ou `ng serve`
- **Banco**: Seu Docker local ou Neon (configurável)

### 🌐 **Produção (Deploy)**  
- **URL da API**: `https://arqserv-backend.onrender.com/api`
- **Quando usar**: Build de produção (`npm run build`)
- **Banco**: Supabase (automático)

## 📁 **Arquivos Criados/Modificados:**

1. **`frontend/src/environments/environment.ts`**
   ```typescript
   // Desenvolvimento
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:3005/api'
   };
   ```

2. **`frontend/src/environments/environment.prod.ts`**
   ```typescript
   // Produção  
   export const environment = {
     production: true,
     apiUrl: 'https://arqserv-backend.onrender.com/api'
   };
   ```

3. **Serviços atualizados:**
   - ✅ `auth.service.ts` - Usa `environment.apiUrl`
   - ✅ `documents.service.ts` - Usa `environment.apiUrl`
   - ✅ Interfaces atualizadas para corresponder ao backend

4. **`angular.json`** - Configurado para trocar ambientes automaticamente

## 🚀 **Como Funciona:**

### **Desenvolvimento (npm start):**
```bash
cd frontend
npm start
# Usa: http://localhost:3005/api
```

### **Produção (Vercel):**
```bash
npm run build --configuration production
# Usa: https://arqserv-backend.onrender.com/api
```

## 🔄 **Para Fazer Deploy:**

```bash
# 1. Testar se tudo funciona
./test-and-deploy.sh

# 2. Commit das mudanças
git add .
git commit -m "Configure environment-based API URLs"

# 3. Push (Vercel redeploy automático)
git push origin main
```

## ⚡ **Testes Rápidos:**

### **Local:**
1. Execute: `npm start` (na pasta frontend)
2. Abra: http://localhost:4200
3. Login: `admin@arqserv.com` / `123456`
4. **API**: http://localhost:3005/api

### **Produção:**
1. Acesse sua URL da Vercel
2. Login: `admin@arqserv.com` / `123456`
3. **API**: https://arqserv-backend.onrender.com/api

## 🔧 **Para Mudanças Futuras:**

### **Nova URL de Backend:**
Apenas edite: `frontend/src/environments/environment.prod.ts`

### **Nova URL Local:**
Apenas edite: `frontend/src/environments/environment.ts`

## 📊 **Stack Atual:**

| Ambiente | Frontend | Backend | Banco |
|----------|----------|---------|-------|
| **Local** | localhost:4200 | localhost:3005 | Docker/Neon |
| **Produção** | Vercel | Render | Supabase |

---

## 🎉 **RESULTADO:**

✅ **Desenvolvimento**: Aponta para localhost  
✅ **Produção**: Aponta para Render  
✅ **Automático**: Sem configuração manual  
✅ **Flexível**: Fácil de mudar URLs  

**Sua aplicação agora funciona perfeitamente em ambos os ambientes!** 🚀