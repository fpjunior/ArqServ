// Load DNS wrapper for Supabase IPv6 support
require('./config/dns-wrapper');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const documentRoutes = require('./routes/document.routes');
const serverRoutes = require('./routes/server.routes');
const municipalityRoutes = require('./routes/municipality.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const activityRoutes = require('./routes/activity.routes');
const financialDocumentTypesRoutes = require('./routes/financial-document-types.routes');
const searchRoutes = require('./routes/search.routes');

// Controller simples para testar
const SimpleDocumentController = require('./controllers/document.simple.controller');

// Configurar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Log de requisições (apenas rotas principais, sem poluir com health checks)
app.use((req, res, next) => {
  // Só logar requisições importantes de escrita ou rotas principais
  if (req.method !== 'GET' || req.path.includes('/upload')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Middleware para logar uploads
app.use('/api/documents/upload', (req, res, next) => {
  console.log('\n🔵 ===== [UPLOAD REQUEST] =====');
  console.log('🔵 Method:', req.method);
  console.log('🔵 Content-Type:', req.headers['content-type']);
  console.log('🔵 Auth:', req.headers.authorization ? 'PRESENTE' : 'AUSENTE');
  console.log('🔵 ============================\n');
  next();
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/municipalities', municipalityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/financial-document-types', financialDocumentTypesRoutes);
app.use('/api/search', searchRoutes);

// Endpoint de diagnóstico do Google Drive
app.get('/api/drive-status', async (req, res) => {
  try {
    const status = {
      oauthInitialized: googleDriveOAuthService.isInitialized(),
      timestamp: new Date().toISOString()
    };

    if (status.oauthInitialized) {
      try {
        const storageInfo = await googleDriveOAuthService.getStorageInfo();
        status.driveConnected = true;
        status.storage = {
          usedMB: (storageInfo.usageInDrive / 1024 / 1024).toFixed(2),
          totalGB: storageInfo.total ? (storageInfo.total / 1024 / 1024 / 1024).toFixed(2) : 'unlimited'
        };
      } catch (driveError) {
        status.driveConnected = false;
        status.driveError = driveError.message;
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotas de teste (sem Google Drive)
app.post('/api/documents/upload-simple',
  SimpleDocumentController.uploadSimple,
  SimpleDocumentController.uploadFileSimple
);

// Rota de upload REAL - salva no Google Drive + PostgreSQL
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const googleDriveService = require('./services/google-drive.service');
const googleDriveOAuthService = require('./services/google-drive-oauth.service');

// Configuração do upload - salvar arquivos localmente primeiro
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/app/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: function (req, file, cb) {
    // Aceitar todos os tipos de arquivo por enquanto
    cb(null, true);
  }
});

// Pool de conexão PostgreSQL
const dbPool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'arqserv_db',
  user: process.env.DB_USER || 'arqserv_user',
  password: process.env.DB_PASSWORD || 'arqserv123',
});

// ROTA DE UPLOAD REMOVIDA - usando apenas document.routes.js + document.controller.js

app.get('/api/documents/simple/municipality/:code',
  SimpleDocumentController.getDocumentsByMunicipalitySimple
);

// Endpoints para o frontend - Municípios (mockado temporariamente)
app.get('/api/municipalities', async (req, res) => {
  try {
    console.log('🔄 Retornando municípios mockados...');
    const mockMunicipalities = [
      { id: 1, code: '2600500', name: 'Aliança', state: 'PE' },
      { id: 2, code: '2600609', name: 'Amaraji', state: 'PE' },
      { id: 3, code: '2600708', name: 'Araçoiaba', state: 'PE' },
      { id: 4, code: '2604106', name: 'Condado', state: 'PE' },
      { id: 5, code: '2611101', name: 'Palmares', state: 'PE' },
      { id: 6, code: '2615607', name: 'Vertente', state: 'PE' },
      { id: 7, code: '2607307', name: 'Ingazeira', state: 'PE' },
      { id: 8, code: '2609907', name: 'Nabuco', state: 'PE' }
    ];

    res.json({
      success: true,
      data: mockMunicipalities
    });
  } catch (error) {
    console.error('❌ Erro ao buscar municípios:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar municípios',
      error: error.message
    });
  }
});

// Endpoints para o frontend - Servidores por município (mockado)
app.get('/api/servers/municipality/:code', async (req, res) => {
  try {
    const { code } = req.params;
    console.log('🔄 Buscando servidores para município:', code);

    const mockServers = {
      '2600500': [ // Aliança
        { id: 1, name: 'Ana Silva Santos', municipality_code: '2600500' },
        { id: 2, name: 'João Carlos Oliveira', municipality_code: '2600500' },
        { id: 3, name: 'Carlos Eduardo Ramos', municipality_code: '2600500' }
      ],
      '2600609': [ // Amaraji  
        { id: 4, name: 'Maria Fernanda Lima', municipality_code: '2600609' },
        { id: 5, name: 'Pedro Henrique Costa', municipality_code: '2600609' },
        { id: 6, name: 'Beatriz Almeida Souza', municipality_code: '2600609' }
      ]
    };

    const servers = mockServers[code] || [];

    res.json({
      success: true,
      data: servers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar servidores',
      error: error.message
    });
  }
});

// Rota de teste
app.get('/api/test', (req, res) => {
  const packageJson = require('../package.json');
  res.json({
    message: 'ArqServ Backend funcionando!',
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Rota Raiz (Health Check para Render)
app.get('/', (req, res) => {
  const packageJson = require('../package.json');
  res.status(200).send(`ArqServ Backend v${packageJson.version} is running!`);
});

// Rota de health check (rápida, sem banco)
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rota específica para versão e status
app.get('/api/version', (req, res) => {
  const packageJson = require('../package.json');
  res.json({
    name: packageJson.name,
    version: packageJson.version,
    status: 'ONLINE',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} segundos`,
    message: `Backend v${packageJson.version} rodando com sucesso!`
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

// Rota para verificar usuários (apenas para debug)
app.get('/api/debug/users', async (req, res) => {
  const pool = require('./config/database');

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT email, name, role FROM users ORDER BY email');
    client.release();

    res.json({
      status: 'SUCCESS',
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao buscar usuários',
      error: error.message
    });
  }
});

// Rota para verificar tabelas do sistema
app.get('/api/debug/tables', async (req, res) => {
  const pool = require('./config/database');

  try {
    const client = await pool.connect();

    // Verificar quais tabelas existem
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = {};

    // Para cada tabela, verificar se existe e mostrar algumas colunas
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      try {
        const columnsResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [tableName]);

        tables[tableName] = {
          exists: true,
          columns: columnsResult.rows
        };
      } catch (err) {
        tables[tableName] = {
          exists: false,
          error: err.message
        };
      }
    }

    client.release();

    res.json({
      status: 'SUCCESS',
      tables: tables
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar tabelas',
      error: error.message
    });
  }
});

// Debug endpoint: check DB network connectivity and DNS resolution
const dns = require('dns');
const net = require('net');
app.get('/api/debug/db-ping', async (req, res) => {
  try {
    const pool = require('./config/database');
    const connString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
    let host = process.env.DB_HOST || null;
    let port = process.env.DB_PORT || null;
    if (connString) {
      try {
        const u = new URL(connString.replace('postgresql://', 'http://'));
        host = u.hostname;
        port = u.port || 5432;
      } catch (err) {
        // ignore
      }
    }

    if (!host) return res.status(400).json({ status: 'ERROR', message: 'No DB host or connection string configured' });

    const results = { host, port: Number(port) };

    // Resolve addresses
    try {
      const addresses = await new Promise((resolve, reject) => {
        dns.lookup(host, { all: true }, (err, addrs) => {
          if (err) return reject(err);
          resolve(addrs);
        });
      });
      results.dns = addresses;
    } catch (err) {
      results.dnsError = err.message;
    }

    // Test TCP connect for each resolved address
    results.tcp = [];
    if (results.dns && results.dns.length > 0) {
      for (const a of results.dns) {
        const ip = a.address;
        const family = a.family;
        const tcpRes = { ip, family };
        try {
          const ok = await new Promise((resolve, reject) => {
            const socket = net.connect({ host: ip, port: Number(port), family: family }, () => {
              socket.end();
              resolve(true);
            });
            socket.setTimeout(3000, () => {
              socket.destroy();
              reject(new Error('timeout'));
            });
            socket.on('error', (e) => { reject(e); });
          });
          tcpRes.connect = ok;
        } catch (err) {
          tcpRes.error = err.message;
        }
        results.tcp.push(tcpRes);
      }
    }

    // Test pool connect
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      results.pool = { connected: true, timestamp: result.rows[0].now };
    } catch (err) {
      results.pool = { connected: false, error: err.message };
    }

    return res.json({ status: 'SUCCESS', results });
  } catch (err) {
    return res.status(500).json({ status: 'ERROR', message: 'db-ping failed', error: err.message });
  }
});

// Inicializar Google Drive services antes de iniciar o servidor
async function initializeServices() {
  console.log('🔄 Inicializando Google Drive services...');
  
  try {
    const driveOAuthInitialized = await googleDriveOAuthService.initialize();
    const driveServiceInitialized = await googleDriveService.initialize();

    // Armazenar serviços no app Express
    app.set('googleDriveOAuthService', googleDriveOAuthService);
    app.set('googleDriveService', googleDriveService);

    if (driveOAuthInitialized) {
      console.log('✅ Google Drive OAuth service pronto!');
    } else if (driveServiceInitialized) {
      console.log('✅ Google Drive service account pronto (com limitações)');
    } else {
      console.log('⚠️ Google Drive não configurado - uploads serão salvos localmente');
    }
  } catch (error) {
    console.log('⚠️ Erro ao inicializar Google Drive:', error.message);
    console.log('⚠️ Uploads serão salvos localmente');
  }
}

// Iniciar servidor - escutar em 0.0.0.0 para aceitar conexões externas (Render)
const server = app.listen(PORT, '0.0.0.0', async () => {
  const packageJson = require('../package.json');
  console.log(`🚀 ArqServ Backend v${packageJson.version} rodando na porta ${PORT}`);
  console.log(`📡 Servidor escutando em 0.0.0.0:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/version`);
  
  // Inicializar serviços em paralelo
  await initializeServices();
  
  console.log('✅ Servidor pronto para receber requisições!');
});

// Tratamento de erros do servidor
server.on('error', (error) => {
  console.error('❌ Erro ao iniciar servidor:', error.message);
  process.exit(1);
});

// Graceful shutdown para Render e outros serviços de cloud
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido, encerrando servidor graciosamente...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido, encerrando servidor graciosamente...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});