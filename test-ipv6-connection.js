const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres.pemveuponvfncukbsbdn',
  password: 'ArqServ2025',
  host: 'db.pemveuponvfncukbsbdn.supabase.co',
  port: 5432,
  database: 'postgres',
  ssl: true,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar:', err);
  } else {
    console.log('✅ Conectado!');
    client.query('SELECT NOW()', (err, res) => {
      release();
      if (err) {
        console.error('❌ Query error:', err);
      } else {
        console.log('✅ Query result:', res.rows[0]);
      }
      process.exit(0);
    });
  }
});
