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
   * Inclui: visualizações, downloads e uploads
   * @route GET /api/dashboard/recent-activities
   */
  static async getRecentActivities(req, res) {
    try {
      const userRole = req.user?.role;
      const userMunicipality = req.user?.municipality_code;
      const limit = parseInt(req.query.limit) || 10;

      console.log('🔵 [DASHBOARD] Endpoint getRecentActivities chamado');
      console.log(`👤 [DASHBOARD] Usuário: role=${userRole}, municipality=${userMunicipality}`);

      // Buscar atividades recentes da tabela activity_logs
      let query = pool.supabase
        .from('activity_logs')
        .select(`
          id,
          activity_type,
          document_id,
          user_id,
          municipality_code,
          metadata,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filtrar por município se não for admin
      if (userRole !== 'admin' && userMunicipality) {
        query = query.eq('municipality_code', userMunicipality);
      }

      const { data: activityLogs, error: logError } = await query;

      if (logError) {
        console.error('❌ [DASHBOARD] Erro ao buscar activity_logs:', logError);
        throw logError;
      }

      console.log(`📊 [DASHBOARD] Encontradas ${activityLogs?.length || 0} atividades na tabela activity_logs`);

      // Buscar informações dos usuários relacionados
      const userIds = [...new Set(activityLogs?.filter(a => a.user_id).map(a => a.user_id) || [])];
      let usersMap = {};

      if (userIds.length > 0) {
        const { data: users, error: userError } = await pool.supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);

        if (!userError && users) {
          usersMap = users.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {});
        }
      }

      // --- ENRIQUECIMENTO DE DADOS (Documentos e Servidores) ---
      const documentIds = [...new Set(activityLogs?.filter(a => a.document_id).map(a => a.document_id) || [])];
      let documentsMap = {};
      let serversMap = {};

      if (documentIds.length > 0) {
        // 1. Buscar detalhes dos documentos
        const { data: documents, error: docError } = await pool.supabase
          .from('documents')
          .select('id, category, financial_document_type, server_id, title')
          .in('id', documentIds);

        if (!docError && documents) {
          console.log('✅ [DEBUG] Documentos encontrados para enriquecimento:', documents.length);
          documentsMap = documents.reduce((acc, doc) => {
            acc[doc.id] = doc;
            return acc;
          }, {});

          // 2. Extrair IDs de servidores dos documentos encontrados
          const serverIds = [...new Set(documents.filter(d => d.server_id).map(d => d.server_id))];

          if (serverIds.length > 0) {
            // 3. Buscar nomes dos servidores
            const { data: servers, error: serverError } = await pool.supabase
              .from('servers')
              .select('id, name')
              .in('id', serverIds);

            if (!serverError && servers) {
              serversMap = servers.reduce((acc, srv) => {
                acc[srv.id] = srv;
                return acc;
              }, {});
            }
          }
        }
      }

      // Formatar atividades
      const activities = (activityLogs || []).map(log => {
        const user = usersMap[log.user_id] || {};
        const metadata = log.metadata || {};
        const fileName = metadata.file_name || 'Arquivo';

        // Dados enriquecidos
        const doc = documentsMap[log.document_id];
        let contextInfo = metadata.context_info || ''; // Prioridade para metadados salvos

        if (!contextInfo && doc) {
          const parts = [];

          // Adiciona tipo financeiro se existir
          if (doc.category === 'financeiro' || doc.financial_document_type) {
            parts.push(doc.financial_document_type || 'Financeiro');
          }

          // Adiciona nome do servidor (pasta) se existir
          if (doc.server_id) {
            const server = serversMap[doc.server_id];
            if (server) {
              parts.push(server.name);
            }
          }

          if (parts.length > 0) {
            contextInfo = ` • ${parts.join(' • ')}`;
          }
        }

        const description = `${fileName}${contextInfo}`;

        // Determinar tipo, título e ícone baseado no activity_type
        let type, title, icon;
        switch (log.activity_type) {
          case 'view':
            type = 'view';
            title = 'Documento visualizado';
            icon = '👁️';
            break;
          case 'download':
            type = 'download';
            title = 'Documento baixado';
            icon = '⬇️';
            break;
          case 'upload':
            type = 'upload';
            title = 'Novo documento adicionado';
            icon = '📤';
            break;
          default:
            type = log.activity_type || 'other';
            title = 'Atividade';
            icon = '📋';
        }

        return {
          id: log.id.toString(),
          type: type,
          title: title,
          description: description,
          timestamp: log.created_at,
          user: user.name || 'Sistema',
          icon: icon,
          documentId: log.document_id,
          fileName: fileName,
          fileSize: metadata.file_size,
          municipalityCode: log.municipality_code
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