/**
 * Script para executar init-roles.sql no Supabase
 * Usa o cliente JavaScript do Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configurações
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pemveuponvfncukbsbdn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlbXZldXBvbnZmbmN1a2JzYmRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTMzMSwiZXhwIjoyMDc4ODE3MzMxfQ.vewQf4fhp9dceEEwWtuOjZLzCflqbX81AMF1cKSHoaA';

// Criar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Ler o arquivo SQL
const sqlFile = path.join(__dirname, 'init-roles.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf-8');

// Dividir em statements individuais
const statements = sqlContent
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log(`📝 Lendo arquivo: ${sqlFile}`);
console.log(`📊 Total de statements a executar: ${statements.length}\n`);

/**
 * Executa um statement SQL via Supabase RPC
 */
async function executeSqlStatement(sql) {
  try {
    // Usar rpc para executar SQL arbitrário
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Erro:', error.message);
      return false;
    }

    console.log('✅ Executado:', sql.substring(0, 80) + '...');
    return true;
  } catch (error) {
    console.error('❌ Erro na execução:', error.message);
    return false;
  }
}

/**
 * Executa statements sequencialmente
 */
async function main() {
  console.log('🔄 Iniciando execução de scripts SQL...\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    console.log(`[${i + 1}/${statements.length}]`);
    
    if (await executeSqlStatement(sql)) {
      success++;
    } else {
      failed++;
    }
    
    // Delay pequeno para evitar rate limit
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n✅ Concluído! Sucesso: ${success}, Falhas: ${failed}`);
}

main().catch(console.error);

