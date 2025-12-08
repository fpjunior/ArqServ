require('dotenv').config();
const { supabase } = require('./src/config/database-supabase.js');

(async () => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('financial_document_type')
      .eq('municipality_code', '9892521')
      .eq('category', 'financeiro')
      .eq('is_active', true)
      .neq('financial_document_type', null);
    
    if (error) throw error;
    
    // Contar por tipo
    const counts = data.reduce((acc, row) => {
      const type = row.financial_document_type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Tipos financeiros para Cachoeirinha (9892521):');
    console.log(JSON.stringify(counts, null, 2));
    console.log('\nTotal de tipos:', Object.keys(counts).length);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
})();
