const bcrypt = require('bcryptjs');

async function testHash() {
  const plainPassword = '123456';
  const hashedPassword = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewBVgOZBLhRcQ.92';
  
  console.log('🧪 Testando hash de senha...');
  console.log('Plain password:', plainPassword);
  console.log('Hash do banco:', hashedPassword);
  
  try {
    // Teste 1: Verificar com bcryptjs
    const isValid1 = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('✅ bcryptjs.compare result:', isValid1);
    
    // Teste 2: Criar novo hash e comparar
    const newHash = await bcrypt.hash(plainPassword, 12);
    console.log('🔄 Novo hash gerado:', newHash);
    
    const isValid2 = await bcrypt.compare(plainPassword, newHash);
    console.log('✅ Novo hash válido:', isValid2);
    
    // Teste 3: Verificar se o hash do banco é válido
    console.log('🔍 Verificando estrutura do hash...');
    console.log('Hash length:', hashedPassword.length);
    console.log('Hash starts with $2a$12$:', hashedPassword.startsWith('$2a$12$'));
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testHash();