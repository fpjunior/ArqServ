const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Support either a full connection string or individual DB env variables
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;

const dbConfig = connectionString ? { connectionString } : {
  user: process.env.DB_USER || 'arqserv_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'arqserv_db',
  password: process.env.DB_PASSWORD || 'arqserv123',
  port: parseInt(process.env.DB_PORT) || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// If connecting to a Supabase managed Postgres instance set SSL to true
// Also ensure SSL when using a connectionString that targets supabase.co
let hostToCheck = null;
try {
  hostToCheck = process.env.DB_HOST || (connectionString ? (new URL(connectionString.replace('postgresql://', 'http://'))).hostname : null);
} catch (err) {
  hostToCheck = process.env.DB_HOST || null;
}
if (hostToCheck && hostToCheck.includes('supabase.co')) {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log(`✅ Conectado ao banco de dados (${process.env.DB_HOST || 'local'})`);
});

pool.on('error', (err) => {
  console.error('❌ Erro no DB pool:', err);
});

// Test connection at startup
pool.connect()
  .then(client => {
    console.log('🔗 Conexão com o banco de dados estabelecida');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar no banco de dados:', err);
  });

module.exports = pool;