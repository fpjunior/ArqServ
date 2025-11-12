const bcrypt = require('bcryptjs');

async function testLoginHashes() {
  const password = '123456';
  
  const users = [
    { email: 'admin@kralinfo.com', hash: '$2b$12$8da4psNjeoWPRENqUQ6KguZzRpYbOIehh0a2Px/eaX/st2ozael2q' },
    { email: 'empresa@test.com', hash: '$2b$12$Kk1iFYa5abHw9Nut0DDmI.mybmCBQ1reP1otbKeTcEdtUY3ylCZGu' },
    { email: 'prefeitura@sp.gov.br', hash: '$2b$12$4/SNkAkgyyRgcw78o72YRuNnzikEosEpnAhL3vmVVEIMvccE2.gR.' },
    { email: 'prefeitura@rj.gov.br', hash: '$2b$12$Wl.hSRD5yx84.92w64IbKeLC0VgrXej3f7.9FZaNUd5bDyv5jcqcC' }
  ];

  console.log('🧪 Testando hashs atualizados...\n');
  
  for (const user of users) {
    try {
      const isValid = await bcrypt.compare(password, user.hash);
      console.log(`✅ ${user.email}: ${isValid ? 'VÁLIDO' : 'INVÁLIDO'}`);
    } catch (error) {
      console.log(`❌ ${user.email}: ERRO - ${error.message}`);
    }
  }
}

testLoginHashes();