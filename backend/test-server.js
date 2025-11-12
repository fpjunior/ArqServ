const express = require('express');

const app = express();
const PORT = 9999;

app.get('/test', (req, res) => {
  res.json({ message: 'Teste simples funcionando!' });
});

app.listen(PORT, () => {
  console.log(`🧪 Servidor teste rodando na porta ${PORT}`);
}).on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
});

console.log('🚀 Tentando iniciar servidor...');