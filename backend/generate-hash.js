const bcrypt = require('bcrypt');

async function generateHash() {
  const password = '123456';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password:', password);
    console.log('Hash:', hash);
    
    // Verificar se o hash está correto
    const isValid = await bcrypt.compare(password, hash);
    console.log('Hash is valid:', isValid);
    
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHash();