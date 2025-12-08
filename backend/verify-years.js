require('dotenv').config();
const { supabase } = require('./src/config/database-supabase.js');

(async () => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('financial_document_type, financial_year')
      .eq('municipality_code', '9892521')
      .eq('category', 'financeiro')
      .eq('is_active', true)
      .neq('financial_document_type', null);
    
    if (error) throw error;
    
    console.log('📊 Documentos financeiros de Cachoeirinha:');
    data.forEach(doc => {
      console.log(`  - Tipo: ${doc.financial_document_type}, Ano: ${doc.financial_year}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
})();
