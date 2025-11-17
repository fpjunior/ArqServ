const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');
// const documentRoutes = require('./routes/document.routes'); // Comentado temporariamente
const serverRoutes = require('./routes/server.routes');
const municipalityRoutes = require('./routes/municipality.routes');

// Controller simples para testar
const SimpleDocumentController = require('./controllers/document.simple.controller');

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
// app.use('/api/documents', documentRoutes); // Comentado temporariamente
app.use('/api/servers', serverRoutes);
app.use('/api/municipalities', municipalityRoutes);

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

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  let client;
  let uploadedToGoogleDrive = false;
  let googleDriveData = null;
  
  try {
    const { title, description, municipality_code, server_id, category } = req.body;
    const file = req.file;

    console.log('📤 Upload COMPLETO recebido:', { 
      title, 
      municipality_code, 
      server_id, 
      category,
      fileName: file?.originalname,
      fileSize: file?.size,
      filePath: file?.path
    });

    // Validações
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    if (!title || !municipality_code || !server_id) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: title, municipality_code, server_id'
      });
    }

    // Conectar ao banco para buscar informações
    client = await dbPool.connect();

    // Buscar informações do município e servidor
    const municipalityQuery = 'SELECT name FROM municipalities WHERE code = $1';
    const serverQuery = 'SELECT name FROM servers WHERE id = $1';
    
    const municipalityResult = await client.query(municipalityQuery, [municipality_code]);
    const serverResult = await client.query(serverQuery, [server_id]);

    if (municipalityResult.rows.length === 0) {
      throw new Error('Município não encontrado');
    }

    if (serverResult.rows.length === 0) {
      throw new Error('Servidor não encontrado');
    }

    const municipalityName = municipalityResult.rows[0].name;
    const serverName = serverResult.rows[0].name;

    console.log(`📁 Preparando upload para: ${municipalityName} > ${serverName}`);

    // Inicializar Google Drive service se não foi inicializado
    if (!googleDriveService.isInitialized()) {
      await googleDriveService.initialize();
    }

    // Tentar upload para Google Drive
    if (googleDriveService.isInitialized()) {
      try {
        console.log('☁️ Uploading to Google Drive...');
        googleDriveData = await googleDriveService.uploadFile(
          file.path,
          file.originalname,
          municipalityName,
          serverName
        );
        uploadedToGoogleDrive = true;
        console.log('✅ Google Drive upload successful:', googleDriveData);
      } catch (driveError) {
        console.error('❌ Google Drive upload failed:', driveError.message);
        console.log('📁 Falling back to local storage...');
      }
    } else {
      console.log('📁 Google Drive not available, using local storage');
    }

    // Preparar dados para inserção no banco
    const insertQuery = `
      INSERT INTO documents (
        title, 
        description, 
        category,
        municipality_code, 
        server_id, 
        file_name, 
        file_path, 
        file_size, 
        mime_type,
        google_drive_id,
        is_active,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `;

    const values = [
      title,
      description || '',
      category || 'geral',
      municipality_code,
      parseInt(server_id),
      file.originalname,
      uploadedToGoogleDrive ? null : file.path, // Se foi pro Drive, não salva path local
      file.size,
      file.mimetype,
      googleDriveData ? googleDriveData.googleDriveId : null,
      true
    ];

    console.log('💾 Salvando metadados no PostgreSQL...');

    const result = await client.query(insertQuery, values);
    const savedDocument = result.rows[0];

    console.log('✅ Documento salvo com sucesso:', savedDocument);

    // Se uploadou para Google Drive, pode deletar arquivo local
    if (uploadedToGoogleDrive && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
        console.log('🗑️ Arquivo local removido após upload para Google Drive');
      } catch (deleteError) {
        console.error('⚠️ Não foi possível deletar arquivo local:', deleteError.message);
      }
    }

    // Preparar resposta
    const responseData = {
      success: true,
      message: uploadedToGoogleDrive 
        ? 'Documento salvo com sucesso no Google Drive!' 
        : 'Documento salvo localmente (Google Drive indisponível)',
      data: {
        document: {
          ...savedDocument,
          municipality_name: municipalityName,
          server_name: serverName
        },
        storage: {
          type: uploadedToGoogleDrive ? 'google_drive' : 'local_file',
          location: uploadedToGoogleDrive 
            ? `Google Drive: ${googleDriveData.googleDriveLink}` 
            : file.path,
          google_drive_id: googleDriveData ? googleDriveData.googleDriveId : null,
          google_drive_link: googleDriveData ? googleDriveData.googleDriveLink : null
        }
      }
    };

    res.status(201).json(responseData);

  } catch (error) {
    console.error('❌ Erro no upload completo:', error);
    
    // Cleanup em caso de erro
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Arquivo local removido após erro');
      } catch (deleteError) {
        console.error('❌ Erro ao deletar arquivo local:', deleteError);
      }
    }

    // Se uploadou para Google Drive mas houve erro depois, tentar deletar do Drive
    if (uploadedToGoogleDrive && googleDriveData) {
      try {
        await googleDriveService.deleteFile(googleDriveData.googleDriveId);
        console.log('🗑️ Arquivo removido do Google Drive após erro');
      } catch (deleteError) {
        console.error('❌ Erro ao deletar do Google Drive:', deleteError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao salvar documento',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});
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
  res.json({ 
    message: 'ArqServ Backend funcionando!', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Rota de health check (rápida, sem banco)
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
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

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 ArqServ Backend rodando na porta ${PORT}`);
  console.log(`📡 Acesse: http://localhost:${PORT}/api/test`);
  
  // Inicializar Google Drive service
  console.log('🔄 Inicializando Google Drive service...');
  const driveInitialized = await googleDriveService.initialize();
  if (driveInitialized) {
    console.log('✅ Google Drive service pronto!');
  } else {
    console.log('⚠️ Google Drive service não disponível - uploads serão salvos localmente');
  }
});