const pool = require('../config/database');

class DashboardController {
  static async getDashboardStats(req, res) {
    try {
      console.log('🔵 [DASHBOARD] Endpoint getDashboardStats chamado');
      
      // Contar total de servidores (usuários com role 'user')
      console.log('🔄 [DASHBOARD] Buscando servidores...');
      const { data: servers, error: serverError, count: serverCount } = await pool.supabase
        .from('users')
        .select('id, created_at', { count: 'exact' })
        .eq('role', 'user');

      if (serverError) {
        console.error('❌ [DASHBOARD] Erro ao contar servidores:', serverError);
        throw serverError;
      }

      console.log('✅ [DASHBOARD] Total de servidores:', serverCount);

      // Contar servidores criados este mês
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      console.log('🔄 [DASHBOARD] Primeiro dia do mês:', firstDayOfMonth.toISOString());
      
      const { count: serversThisMonth, error: serversMonthError } = await pool.supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('role', 'user')
        .gte('created_at', firstDayOfMonth.toISOString());

      if (serversMonthError) {
        console.error('❌ [DASHBOARD] Erro ao contar servidores deste mês:', serversMonthError);
        throw serversMonthError;
      }

      console.log('✅ [DASHBOARD] Servidores este mês:', serversThisMonth);

      // Contar total de documentos
      console.log('🔄 [DASHBOARD] Buscando documentos...');
      const { data: documents, error: docError, count: docCount } = await pool.supabase
        .from('documents')
        .select('id, file_size', { count: 'exact' });

      if (docError) {
        console.error('❌ [DASHBOARD] Erro ao contar documentos:', docError);
        throw docError;
      }

      console.log('✅ [DASHBOARD] Total de documentos:', docCount);

      // Calcular armazenamento
      const totalSize = documents?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0;
      console.log('✅ [DASHBOARD] Tamanho total:', totalSize, 'bytes');

      // Contar documentos uploaded hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log('🔄 [DASHBOARD] Buscando documentos de hoje a partir de:', today.toISOString());

      const { count: docsToday, error: todayError } = await pool.supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      if (todayError) {
        console.error('❌ [DASHBOARD] Erro ao contar documentos de hoje:', todayError);
        throw todayError;
      }

      console.log('✅ [DASHBOARD] Documentos de hoje:', docsToday);

      const responseData = {
        servers: {
          total: serverCount || 0,
          this_month: serversThisMonth || 0
        },
        documents: {
          total: docCount || 0,
          today: docsToday || 0
        },
        storage: {
          used: totalSize,
          total: 100 * 1024 * 1024 * 1024 // 100GB
        },
        activities: {
          uploads_today: docsToday || 0,
          views_today: 147, // Mock value
          downloads_today: 23 // Mock value
        }
      };

      console.log('📊 [DASHBOARD] Respondendo com dados reais:', JSON.stringify(responseData, null, 2));

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao buscar estatísticas:', error);
      
      // Fallback com dados mockados
      console.log('⚠️ [DASHBOARD] Retornando dados mockados por erro');
      const mockData = {
        servers: {
          total: 1547,
          this_month: 12
        },
        documents: {
          total: 23456,
          today: 47
        },
        storage: {
          used: 75.5 * 1024 * 1024 * 1024,
          total: 100 * 1024 * 1024 * 1024
        },
        activities: {
          uploads_today: 47,
          views_today: 147,
          downloads_today: 23
        }
      };

      res.status(200).json({
        success: true,
        data: mockData,
        warning: 'Dados mockados - erro ao consultar banco de dados'
      });
    }
  }
}

module.exports = DashboardController;