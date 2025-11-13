const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');

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

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'ArqServ Backend funcionando!', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 ArqServ Backend rodando na porta ${PORT}`);
  console.log(`📡 Acesse: http://localhost:${PORT}/api/test`);
});