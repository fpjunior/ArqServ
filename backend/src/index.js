const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const serverRoutes = require('./routes/server.routes');
const municipalityRoutes = require('./routes/municipality.routes');

// Configurar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log de requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/municipalities', municipalityRoutes);

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'ArqServ Backend funcionando!', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Rota de debug para verificar configurações
app.get('/api/debug', async (req, res) => {
  const pool = require('./config/database');
  
  try {
    // Testar conexão com o banco
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({
      status: 'SUCCESS',
      message: 'Conexões OK',
      database: {
        connected: true,
        timestamp: result.rows[0].now
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DB_HOST: process.env.DB_HOST ? '***configured***' : 'NOT_SET',
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER ? '***configured***' : 'NOT_SET',
        DB_PASSWORD: process.env.DB_PASSWORD ? '***configured***' : 'NOT_SET',
        JWT_SECRET: process.env.JWT_SECRET ? '***configured***' : 'NOT_SET',
        PORT: PORT
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro de conexão',
      error: error.message,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DB_HOST: process.env.DB_HOST ? '***configured***' : 'NOT_SET',
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER ? '***configured***' : 'NOT_SET',
        DB_PASSWORD: process.env.DB_PASSWORD ? '***configured***' : 'NOT_SET',
        JWT_SECRET: process.env.JWT_SECRET ? '***configured***' : 'NOT_SET',
        PORT: PORT
      }
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 ArqServ Backend rodando na porta ${PORT}`);
  console.log(`📡 Acesse: http://localhost:${PORT}/api/test`);
});