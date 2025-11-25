const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
});

// Expose a query method that works with Supabase
const pool = {
  query: async (sql, values) => {
    console.warn('⚠️ Using Supabase REST API instead of direct SQL');
    throw new Error('Use Supabase client methods instead of raw SQL');
  },
  
  connect: async () => {
    console.log('✅ Supabase client initialized');
    return {
      query: async (sql, values) => {
        throw new Error('Use Supabase client methods instead of raw SQL');
      },
      release: () => {}
    };
  },
  
  // Expose supabase client for use in controllers
  supabase: supabase,
};

module.exports = pool;
