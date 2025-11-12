const pkg = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const { Pool } = pkg;

// Configuração da conexão PostgreSQL
const dbConfig = {
  user: process.env.DB_USER || 'arqserv_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'arqserv_db',
  password: process.env.DB_PASSWORD || 'arqserv123',
  port: parseInt(process.env.DB_PORT) || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Criar pool de conexões
const pool = new Pool(dbConfig);

// Listener para eventos do pool
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro no PostgreSQL:', err);
});

// Testar conexão na inicialização
pool.connect()
  .then(client => {
    console.log('🔗 Conexão com PostgreSQL estabelecida');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar no PostgreSQL:', err);
  });

module.exports = pool;