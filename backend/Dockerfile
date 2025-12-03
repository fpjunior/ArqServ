# Dockerfile para desenvolvimento com hot reload
FROM node:20-alpine

# NOTE: Supabase JS packages require Node >= 20 — switching to node:20-alpine to avoid engine warnings

# Definir diretório de trabalho
WORKDIR /app

# Criar diretório de uploads
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Instalar nodemon globalmente para desenvolvimento
RUN npm install -g nodemon

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte (será sobrescrito pelo volume em dev)
COPY . .

# Expor porta
EXPOSE 3001

# Comando padrão (desenvolvimento com nodemon)
CMD ["npm", "run", "dev"]