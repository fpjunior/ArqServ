const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Configurar variáveis de ambiente
dotenv.config();

// Importar configuração do banco
const { testConnection } = require('./config/database');

// Importar rotas
console.log('📁 Carregando rotas...');
const authRoutes = require('./routes/auth.routes');
console.log('✅ Auth routes carregadas');
const documentRoutes = require('./routes/document.routes');
console.log('✅ Document routes carregadas');
const serverRoutes = require('./routes/server.routes');
console.log('✅ Server routes carregadas');
const municipalityRoutes = require('./routes/municipality.routes');
console.log('✅ Municipality routes carregadas');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'ArqServ Backend funcionando!'
  });
});

// Rotas da API
console.log('🔗 Registrando rotas...');
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes registradas em /api/auth');
app.use('/api/documents', documentRoutes);
console.log('✅ Document routes registradas em /api/documents');
app.use('/api/servers', serverRoutes);
console.log('✅ Server routes registradas em /api/servers');
app.use('/api/municipalities', municipalityRoutes);
console.log('✅ Municipality routes registradas em /api/municipalities');

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({
    message: 'ArqServ Backend funcionando!',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado!'
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// Iniciar servidor
const startServer = async () => {
  try {
    // Testar conexão com o banco
    await testConnection();
    console.log('✅ Conectado ao PostgreSQL:', new Date().toISOString());
    if (process.env.SUPABASE_URL) {
      console.log('🔗 Supabase URL configured:', process.env.SUPABASE_URL);
    }

    // Iniciar o servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor ArqServ rodando na porta ${PORT}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`📋 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
};

startServer();