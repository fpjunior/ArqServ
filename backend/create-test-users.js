/**
 * Script para criar usuários de teste no Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Configurações
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pemveuponvfncukbsbdn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlbXZldXBvbnZmbmN1a2JzYmRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTMzMSwiZXhwIjoyMDc4ODE3MzMxfQ.vewQf4fhp9dceEEwWtuOjZLzCflqbX81AMF1cKSHoaA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Cria usuários de teste
 */
async function createTestUsers() {
  console.log('🚀 Criando usuários de teste...\n');

  const users = [
    {
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
      // user_type removido
      // municipality removido
      active: true
    },
    {
      name: 'Regular User',
      email: 'user@test.com',
      password: 'user123',
      role: 'user',
      // user_type removido
      // municipality removido
      is_active: true
    },
    {
      name: 'Manager User',
      email: 'manager@test.com',
      password: 'manager123',
      role: 'manager',
      user_type: 'prefeitura',
      municipality: 'Test City',
      is_active: true
    }
  ];

  for (const user of users) {
    try {
      // Hash da senha
      const hashedPassword = await bcrypt.hash(user.password, 10);

      console.log(`📝 Criando: ${user.email} (${user.role})`);

      // Inserir usuário
      const { data, error } = await supabase
        .from('users')
        .insert([{
          name: user.name,
          email: user.email,
          password: hashedPassword,
          role: user.role,
          active: user.active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error('❌ Erro:', error.message);
      } else {
        console.log(`✅ Criado com ID: ${data[0]?.id}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao criar ${user.email}:`, error.message);
    }
  }

  console.log('\n✅ Processo concluído!');
}

createTestUsers().catch(console.error);
