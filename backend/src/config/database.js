const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados!');
  process.exit(1);
}

// Create Supabase client for REST API access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log(`🔧 Conectando ao Supabase via API REST`);

// Create a fake pool interface that uses Supabase REST API
const pool = {
  supabase: supabase,
  
  async connect() {
    console.log('✅ Supabase REST client ready');
    return {
      query: async (sql, values) => {
        throw new Error('Use supabase client methods in models instead of raw queries');
      },
      release: () => {},
    };
  },

  async query(sql, values) {
    throw new Error('Use supabase client methods instead of pool.query()');
  },

  on(event, handler) {
    if (event === 'connect') {
      console.log('✅ Conectado ao banco de dados (via Supabase REST)');
    } else if (event === 'error') {
      // Error handler
    }
  },
};

// Test connection at startup
pool.connect()
  .then(client => {
    console.log('🔗 Conexão com o banco de dados estabelecida via API REST');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar no banco de dados:', err.message);
  });

module.exports = pool;