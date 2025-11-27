/**
 * Script para gerar novo GOOGLE_REFRESH_TOKEN
 * 
 * Este token expira ou é revogado quando:
 * - Você revoga o acesso manualmente no Google
 * - Passa muito tempo sem uso (6 meses)
 * - As credenciais OAuth foram alteradas
 * 
 * COMO USAR:
 * 1. Execute: node generate-refresh-token.js
 * 2. Abra a URL que aparecer no navegador
 * 3. Faça login com sua conta Google
 * 4. Autorize o acesso
 * 5. Copie o código da URL de retorno
 * 6. Cole quando o script pedir
 * 7. Copie o REFRESH_TOKEN gerado e coloque no .env
 */

const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3005/auth/google/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Force para sempre gerar refresh_token
});

console.log('\n🔐 GERAR NOVO REFRESH TOKEN DO GOOGLE DRIVE\n');
console.log('📋 Passo 1: Abra esta URL no navegador:\n');
console.log(authUrl);
console.log('\n📋 Passo 2: Faça login e autorize o acesso');
console.log('📋 Passo 3: Você será redirecionado para: http://localhost:3005/auth/google/callback?code=...');
console.log('📋 Passo 4: Copie o CÓDIGO da URL (tudo depois de "code=")');
console.log('\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Cole o código aqui: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ Token gerado com sucesso!\n');
    console.log('📝 Adicione estas linhas no arquivo backend/.env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n💾 Salve o .env e reinicie o Docker:\n');
    console.log('docker-compose down');
    console.log('docker-compose up -d\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao gerar token:', error.message);
    console.log('\n💡 Verifique se:');
    console.log('- O código foi copiado corretamente');
    console.log('- GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão corretos no .env');
    console.log('- As credenciais OAuth ainda são válidas no Google Console');
  }
  
  rl.close();
});
