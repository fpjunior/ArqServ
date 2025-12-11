const pool = require('../config/database');
const ActivityLogService = require('../services/activity-log.service');

/**
 * Função auxiliar para determinar o tipo de atividade baseado no documento
 */
function getActivityType(doc) {
  // Por enquanto, todos os documentos são considerados uploads
  // No futuro, podemos expandir isso para incluir views, downloads, edits
  const mimeType = doc.mime_type || '';

  if (mimeType.includes('pdf')) {
    return {
      type: 'upload',
      title: 'Novo documento adicionado',
      icon: '📄'
    };
  } else if (mimeType.includes('image')) {
    return {
      type: 'upload',
      title: 'Nova imagem adicionada',
      icon: '🖼️'
    };
  } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return {
      type: 'upload',
      title: 'Planilha adicionada',
      icon: '📊'
    };
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    return {
      type: 'upload',
      title: 'Documento Word adicionado',
      icon: '📝'
    };
  } else {
    return {
      type: 'upload',
      title: 'Arquivo adicionado',
      icon: '📁'
    };
  }
}

class DashboardController {
  /**
   * Obter atividades recentes do dashboard
   * @route GET /api/dashboard/recent-activities
   */
  static async getRecentActivities(req, res) {
    try {
      const userRole = req.user?.role;
      const userMunicipality = req.user?.municipality_code;
      const limit = parseInt(req.query.limit) || 10;

      console.log('🔵 [DASHBOARD] Endpoint getRecentActivities chamado');
      console.log(`👤 [DASHBOARD] Usuário: role=${userRole}, municipality=${userMunicipality}`);

      // Buscar documentos recentes com informações do servidor
      let query = pool.supabase
        .from('documents')
        .select(`
          id,
          title,
          file_name,
          file_size,
          mime_type,
          category,
          created_at,
          server_id,
          uploaded_by,
          municipality_code
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filtrar por município se não for admin
      if (userRole !== 'admin' && userMunicipality) {
        query = query.eq('municipality_code', userMunicipality);
      }

      const { data: documents, error: docError } = await query;

      if (docError) {
        console.error('❌ [DASHBOARD] Erro ao buscar documentos recentes:', docError);
        throw docError;
      }

      // Buscar informações dos servidores relacionados
      const serverIds = [...new Set(documents?.filter(d => d.server_id).map(d => d.server_id) || [])];
      let serversMap = {};

      if (serverIds.length > 0) {
        const { data: servers, error: serverError } = await pool.supabase
          .from('users')
          .select('id, name, email')
          .in('id', serverIds);

        if (!serverError && servers) {
          serversMap = servers.reduce((acc, server) => {
            acc[server.id] = server;
            return acc;
          }, {});
        }
      }

      // Formatar atividades
      const activities = (documents || []).map(doc => {
        const server = serversMap[doc.server_id] || {};
        const activityType = getActivityType(doc);

        return {
          id: doc.id.toString(),
          type: activityType.type,
          title: activityType.title,
          description: `${doc.file_name}${server.name ? ` - ${server.name}` : ''}`,
          timestamp: doc.created_at,
          user: server.name || 'Sistema',
          icon: activityType.icon,
          documentId: doc.id,
          fileName: doc.file_name,
          fileSize: doc.file_size,
          category: doc.category
        };
      });

      console.log(`✅ [DASHBOARD] Retornando ${activities.length} atividades recentes`);

      res.json({
        success: true,
        data: activities
      });

    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao buscar atividades recentes:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar atividades recentes',
        error: error.message
      });
    }
  }

  static async getDashboardStats(req, res) {
    try {
      const userRole = req.user?.role;
      const userMunicipality = req.user?.municipality_code;

      console.log('🔵 [DASHBOARD] Endpoint getDashboardStats chamado');
      console.log(`👤 [DASHBOARD] Usuário: role=${userRole}, municipality=${userMunicipality}`);

      // Contar total de servidores (usuários com role 'user')
      console.log('🔄 [DASHBOARD] Buscando servidores...');
      let serversQuery = pool.supabase
        .from('users')
        .select('id, created_at, municipality_code', { count: 'exact' })
        .eq('role', 'user');

      // Filtrar por município se for user (não admin)
      if (userRole !== 'admin' && userMunicipality) {
        console.log(`🔒 [DASHBOARD] Filtrando por município: ${userMunicipality}`);
        serversQuery = serversQuery.eq('municipality_code', userMunicipality);
      }

      const { data: servers, error: serverError, count: serverCount } = await serversQuery;

      if (serverError) {
        console.error('❌ [DASHBOARD] Erro ao contar servidores:', serverError);
        throw serverError;
      }

      console.log('✅ [DASHBOARD] Total de servidores:', serverCount);

      // Contar servidores criados este mês
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      console.log('🔄 [DASHBOARD] Primeiro dia do mês:', firstDayOfMonth.toISOString());

      let serversMonthQuery = pool.supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('role', 'user')
        .gte('created_at', firstDayOfMonth.toISOString());

      // Filtrar por município se for user (não admin)
      if (userRole !== 'admin' && userMunicipality) {
        serversMonthQuery = serversMonthQuery.eq('municipality_code', userMunicipality);
      }

      const { count: serversThisMonth, error: serversMonthError } = await serversMonthQuery;

      if (serversMonthError) {
        console.error('❌ [DASHBOARD] Erro ao contar servidores deste mês:', serversMonthError);
        throw serversMonthError;
      }

      console.log('✅ [DASHBOARD] Servidores este mês:', serversThisMonth);

      // Contar total de documentos
      console.log('🔄 [DASHBOARD] Buscando documentos...');
      let docsQuery = pool.supabase
        .from('documents')
        .select('id, file_size', { count: 'exact' });

      // Filtrar por município se for user (não admin)
      if (userRole !== 'admin' && userMunicipality) {
        docsQuery = docsQuery.eq('municipality_code', userMunicipality);
      }

      const { data: documents, error: docError, count: docCount } = await docsQuery;

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

      let docsTodayQuery = pool.supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      // Filtrar por município se for user (não admin)
      if (userRole !== 'admin' && userMunicipality) {
        docsTodayQuery = docsTodayQuery.eq('municipality_code', userMunicipality);
      }

      const { count: docsToday, error: todayError } = await docsTodayQuery;

      if (todayError) {
        console.error('❌ [DASHBOARD] Erro ao contar documentos de hoje:', todayError);
        throw todayError;
      }

      console.log('✅ [DASHBOARD] Documentos de hoje:', docsToday);

      // Determinar filtro de município para atividades
      const activityMunicipalityFilter = (userRole !== 'admin' && userMunicipality) ? userMunicipality : null;
      console.log(`🔍 [DASHBOARD] Filtro de município para atividades: ${activityMunicipalityFilter || 'TODOS (admin)'}`);

      // Contar visualizações de hoje
      const viewsToday = await ActivityLogService.countViewsToday(activityMunicipalityFilter);
      console.log('✅ [DASHBOARD] Visualizações de hoje:', viewsToday);

      // Contar downloads de hoje
      const downloadsToday = await ActivityLogService.countDownloadsToday(activityMunicipalityFilter);
      console.log('✅ [DASHBOARD] Downloads de hoje:', downloadsToday);

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
          views_today: viewsToday,
          downloads_today: downloadsToday
        }
      };

      console.log('📊 [DASHBOARD] Respondendo com dados reais:', JSON.stringify(responseData, null, 2));

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao buscar estatísticas:', error);

      // Fallback com dados zerados (melhor que dados falsos)
      console.log('⚠️ [DASHBOARD] Retornando dados zerados por erro');
      const fallbackData = {
        servers: {
          total: 0,
          this_month: 0
        },
        documents: {
          total: 0,
          today: 0
        },
        storage: {
          used: 0,
          total: 100 * 1024 * 1024 * 1024
        },
        activities: {
          uploads_today: 0,
          views_today: 0,
          downloads_today: 0
        }
      };

      res.status(200).json({
        success: true,
        data: fallbackData,
        warning: 'Dados zerados - erro ao consultar banco de dados'
      });
    }
  }
}

module.exports = DashboardController;