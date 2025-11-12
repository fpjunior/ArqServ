const bcrypt = require('bcrypt');

// Testar se o hash da senha está correto
async function testPassword() {
  const plainPassword = '123456';
  const hashedPassword = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewBVgOZBLhRcQ.92';
  
  console.log('🧪 Testando senha...');
  console.log('Senha plain:', plainPassword);
  console.log('Hash no banco:', hashedPassword);
  
  try {
    const isValid = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('✅ Resultado:', isValid);
    
    // Vamos também criar um novo hash para comparar
    const newHash = await bcrypt.hash(plainPassword, 12);
    console.log('🔄 Novo hash:', newHash);
    
    const isValidNewHash = await bcrypt.compare(plainPassword, newHash);
    console.log('✅ Novo hash válido:', isValidNewHash);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testPassword();