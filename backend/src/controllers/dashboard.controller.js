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
  /**
   * Obter documentos acessados recentemente (únicos)
   * @route GET /api/dashboard/recent-documents
   */
  static async getRecentDocuments(req, res) {
    try {
      const userRole = req.user?.role;
      const userMunicipality = req.user?.municipality_code;
      const limit = parseInt(req.query.limit) || 3;

      console.log('🔵 [DASHBOARD] Endpoint getRecentDocuments chamado');
      console.log(`👤 [DASHBOARD] Usuário: role=${userRole}, municipality=${userMunicipality}`);

      // 1. Buscar logs de atividade recentes da tabela activity_logs
      // Trazemos metadata para conseguir processar arquivos do Drive (sem document_id no banco)
      let query = pool.supabase
        .from('activity_logs')
        .select('document_id, activity_type, created_at, metadata, municipality_code')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filtrar por município se não for admin
      if (userRole !== 'admin' && userMunicipality) {
        query = query.eq('municipality_code', userMunicipality);
      }

      const { data: logs, error } = await query;

      if (error) {
        console.error('❌ [DASHBOARD] Erro ao buscar logs:', error);
        throw error;
      }

      // 2. Processar logs para montar a lista de documentos
      const uniqueDocs = [];
      const seenKeys = new Set(); // Pode ser ID do banco ou Drive ID

      // Coletar IDs de documentos que foram deletados para excluir dos recentes
      const deletedDocIds = new Set();
      const deletedDriveIds = new Set();
      if (logs) {
        for (const log of logs) {
          if (log.activity_type === 'delete') {
            if (log.document_id) deletedDocIds.add(log.document_id);
            if (log.metadata?.drive_file_id) deletedDriveIds.add(log.metadata.drive_file_id);
            if (log.metadata?.driveId) deletedDriveIds.add(log.metadata.driveId);
            if (log.metadata?.google_drive_id) deletedDriveIds.add(log.metadata.google_drive_id);
          }
        }
      }
      console.log(`🗑️ [DASHBOARD] IDs deletados - docs: [${Array.from(deletedDocIds)}], drive: [${Array.from(deletedDriveIds)}]`);

      const dbDocumentIds = [];
      const driveIds = [];

      // Pré-processamento: separar o que precisa buscar no banco
      if (logs) {
        for (const log of logs) {
          if (log.document_id) {
            dbDocumentIds.push(log.document_id);
          } else if (log.metadata && (log.metadata.drive_file_id || log.metadata.driveId)) {
            driveIds.push(log.metadata.drive_file_id || log.metadata.driveId);
          }
        }
      }

      // Buscar detalhes dos documentos de banco em lote (ID ou Drive ID)
      let dbDocsMap = {};
      if (dbDocumentIds.length > 0 || driveIds.length > 0) {

        const queries = [];
        if (dbDocumentIds.length > 0) {
          queries.push(pool.supabase.from('documents').select('id, title, file_name, mime_type, category, financial_document_type, file_size, updated_at, file_path, google_drive_id, municipality_code, server_id').in('id', dbDocumentIds));
        }
        if (driveIds.length > 0) {
          queries.push(pool.supabase.from('documents').select('id, title, file_name, mime_type, category, financial_document_type, file_size, updated_at, file_path, google_drive_id, municipality_code, server_id').in('google_drive_id', driveIds));
        }

        const results = await Promise.all(queries);
        const allDocs = [];
        results.forEach(r => {
          if (r.data) allDocs.push(...r.data);
          if (r.error) console.error('Erro getRecentDocs:', r.error);
        });

        if (allDocs.length > 0) {
          dbDocsMap = allDocs.reduce((acc, doc) => {
            acc[doc.id] = doc;
            if (doc.google_drive_id) {
              acc[`drive_${doc.google_drive_id}`] = doc;
            }
            return acc;
          }, {});
        }
      }

      // 3. Coletar IDs únicos de municípios e servidores para busca em lote
      const municipalityCodes = new Set();
      const serverIds = new Set();

      if (logs) {
        for (const log of logs) {
          if (log.municipality_code) {
            municipalityCodes.add(log.municipality_code);
          }
          if (log.document_id && dbDocsMap[log.document_id]) {
            const doc = dbDocsMap[log.document_id];
            if (doc.municipality_code) municipalityCodes.add(doc.municipality_code);
            if (doc.server_id) serverIds.add(doc.server_id);
          }
        }
      }

      // Buscar nomes dos servidores (pastas) - INCLUINDO municipality_code
      let serversMap = {};
      if (serverIds.size > 0) {
        const { data: servers, error: srvError } = await pool.supabase
          .from('servers')
          .select('id, name, municipality_code')
          .in('id', Array.from(serverIds));

        if (!srvError && servers) {
          serversMap = servers.reduce((acc, srv) => {
            acc[srv.id] = { name: srv.name, municipality_code: srv.municipality_code };
            return acc;
          }, {});

          // Adicionar municipality_codes dos servidores ao conjunto para buscar nomes
          servers.forEach(srv => {
            if (srv.municipality_code) {
              municipalityCodes.add(srv.municipality_code);
            }
          });
        }
      }

      // Buscar nomes dos municípios (DEPOIS de coletar todos os códigos, incluindo dos servidores)
      let municipalitiesMap = {};
      console.log(`📍 [DEBUG] Códigos de municípios coletados: ${Array.from(municipalityCodes).join(', ')}`);
      console.log(`🏢 [DEBUG] IDs de servidores coletados: ${Array.from(serverIds).join(', ')}`);
      console.log(`🗺️ [DEBUG] serversMap:`, JSON.stringify(serversMap, null, 2));

      if (municipalityCodes.size > 0) {
        const { data: municipalities, error: munError } = await pool.supabase
          .from('municipalities')
          .select('code, name')
          .in('code', Array.from(municipalityCodes));

        if (!munError && municipalities) {
          municipalitiesMap = municipalities.reduce((acc, mun) => {
            acc[mun.code] = mun.name;
            return acc;
          }, {});
        }
        console.log(`🏛️ [DEBUG] municipalitiesMap:`, JSON.stringify(municipalitiesMap, null, 2));
      }

      // 4. Construir lista final
      if (logs) {
        for (const log of logs) {
          // Pular logs de delete
          if (log.activity_type === 'delete') continue;

          let docItem = null;
          let uniqueKey = null;

          // Verificar se este documento foi deletado
          if (log.document_id && deletedDocIds.has(log.document_id)) {
            console.log(`⏭️ [DASHBOARD] Pulando doc ID=${log.document_id} (foi deletado)`);
            continue;
          }
          const logDriveId = log.metadata?.drive_file_id || log.metadata?.driveId;
          if (logDriveId && deletedDriveIds.has(logDriveId)) {
            console.log(`⏭️ [DASHBOARD] Pulando drive ID=${logDriveId} (foi deletado)`);
            continue;
          }

          // CASO 1: Documento de Banco (Direto ou via Drive ID)
          let dbDoc = null;
          if (log.document_id && dbDocsMap[log.document_id]) {
            dbDoc = dbDocsMap[log.document_id];
          } else if (log.metadata && (log.metadata.drive_file_id || log.metadata.driveId)) {
            const dId = log.metadata.drive_file_id || log.metadata.driveId;
            dbDoc = dbDocsMap[`drive_${dId}`];
          }

          if (dbDoc) {
            uniqueKey = `db_${dbDoc.id}`;

            // Validação de titulo
            const title = dbDoc.title || dbDoc.file_name;

            // DEBUG EXTREMO
            console.log(`🔍 [DEBUG] Validando Doc BD: ID=${dbDoc.id}, Title='${title}'`);

            // STRICT FILTER: Ignorar se não tiver titulo valido
            // Check for at least one meaningful character (letters/numbers)
            const hasContent = /[a-zA-Z0-9\u00C0-\u00FF]/.test(title);
            if (!title || !title.trim() || title.trim() === '.' || !hasContent) {
              console.log(`⛔ [DEBUG] REJEITADO (Título inválido/inútil): '${title}'`);
              continue;
            }
            console.log(`✅ [DEBUG] APROVADO: '${title}'`);

            const mime = dbDoc.mime_type || '';
            let icon = '📄';
            if (mime.includes('pdf')) icon = '📕';
            else if (mime.includes('image')) icon = '🖼️';
            else if (mime.includes('spreadsheet') || mime.includes('excel')) icon = '📊';
            else if (mime.includes('word')) icon = '📝';

            // Determinar folderName (pasta ou tipo de documento financeiro)
            let folderName = null;
            let serverMunicipalityCode = null;
            if (dbDoc.server_id && serversMap[dbDoc.server_id]) {
              folderName = serversMap[dbDoc.server_id].name;
              serverMunicipalityCode = serversMap[dbDoc.server_id].municipality_code;
            } else if (dbDoc.category === 'financeiro' && dbDoc.financial_document_type) {
              folderName = dbDoc.financial_document_type;
            }

            // Determinar municipalityName - priorizar: documento > servidor > log
            const municipalityCode = dbDoc.municipality_code || serverMunicipalityCode || log.municipality_code;
            const municipalityName = municipalitiesMap[municipalityCode] || null;

            console.log(`📄 [DEBUG] Doc ID=${dbDoc.id}: docMun=${dbDoc.municipality_code}, serverMun=${serverMunicipalityCode}, logMun=${log.municipality_code}`);
            console.log(`   -> code=${municipalityCode}, name=${municipalityName}, folder=${folderName}`);

            docItem = {
              id: dbDoc.id,
              title: title,
              subTitle: folderName || (dbDoc.category === 'financeiro' ? (dbDoc.financial_document_type || 'Financeiro') : 'Documento'),
              updatedAt: log.created_at,
              lastAction: log.activity_type,
              icon: icon,
              fileSize: dbDoc.file_size,
              filePath: dbDoc.file_path,
              googleDriveId: dbDoc.google_drive_id,
              municipalityName: municipalityName,
              municipalityCode: municipalityCode,
              folderName: folderName,
              // Explicit server name
              serverName: (dbDoc.server_id && serversMap[dbDoc.server_id]) ? serversMap[dbDoc.server_id].name : null
            };
          }
          // CASO 2: Documento apenas do Drive (via Metadata)
          else if (log.metadata && (log.metadata.file_name || log.metadata.title)) {
            // Se o log tinha document_id mas o documento não existe mais no banco, foi deletado
            if (log.document_id) {
              console.log(`⏭️ [DASHBOARD] Pulando doc ID=${log.document_id} (documento deletado do banco, não encontrado em dbDocsMap)`);
              continue;
            }

            // Tentar usar drive_file_id como chave unica
            const driveId = log.metadata.drive_file_id || log.metadata.driveId;
            if (!driveId) continue; // Sem ID, ignora

            // Se o driveId foi consultado no banco mas não existe, provavelmente foi deletado
            if (driveId && driveIds.includes(driveId) && !dbDocsMap[`drive_${driveId}`]) {
              console.log(`⏭️ [DASHBOARD] Pulando drive ID=${driveId} (arquivo não encontrado no banco, possivelmente deletado)`);
              continue;
            }

            uniqueKey = `drive_${driveId}`;

            const title = log.metadata.title || log.metadata.file_name;

            // DEBUG EXTREMO
            console.log(`🔍 [DEBUG] Validando Doc Drive: ID=${driveId}, Title='${title}'`);

            // STRICT FILTER: Ignorar se não tiver titulo valido
            // Check for at least one meaningful character (letters/numbers)
            const hasContent = /[a-zA-Z0-9\u00C0-\u00FF]/.test(title);
            if (!title || !title.trim() || title.trim() === '.' || !hasContent) {
              console.log(`⛔ [DEBUG] REJEITADO (Título inválido/inútil): '${title}'`);
              continue;
            }
            console.log(`✅ [DEBUG] APROVADO: '${title}'`);

            const mime = log.metadata.mime_type || '';
            let icon = '📄';
            let typeLabel = 'Arquivo';

            if (mime.includes('pdf')) { icon = '📕'; typeLabel = 'PDF'; }
            else if (mime.includes('image')) { icon = '🖼️'; typeLabel = 'Imagem'; }
            else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet')) { icon = '📊'; typeLabel = 'Planilha'; }
            else if (mime.includes('word') || mime.includes('document')) { icon = '📝'; typeLabel = 'Documento'; }
            else if (mime.includes('folder')) { icon = '📁'; typeLabel = 'Pasta'; }

            // Determinar municipalityName para arquivos do Drive
            const municipalityName = municipalitiesMap[log.municipality_code] || null;

            docItem = {
              id: uniqueKey, // ID Virtual
              title: title,
              subTitle: `${typeLabel} • Google Drive`, // Subtitulo mais descritivo
              updatedAt: log.created_at,
              lastAction: log.activity_type,
              icon: icon,
              fileSize: log.metadata.file_size || 0,
              filePath: null, // Geralmente nulo para drive direto
              googleDriveId: driveId,
              // Novos campos para admin
              municipalityName: municipalityName,
              municipalityCode: log.municipality_code,
              folderName: log.metadata.context_info || null
            };
          }

          // Adicionar se válido e único
          if (docItem && uniqueKey && !seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            uniqueDocs.push(docItem);
          }

          if (uniqueDocs.length >= limit) break;
        }
      }

      console.log(`✅ [DASHBOARD] Retornando ${uniqueDocs.length} documentos recentes`);

      res.json({
        success: true,
        data: uniqueDocs,
        // Informar ao frontend se é admin para exibição condicional
        isAdmin: userRole === 'admin'
      });

    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao buscar documentos recentes:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar documentos recentes'
      });
    }
  }

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

      // Coletar Drive IDs de logs sem document_id
      const driveIds = [...new Set(activityLogs?.filter(a => !a.document_id && a.metadata && (a.metadata.drive_file_id || a.metadata.driveId))
        .map(a => a.metadata.drive_file_id || a.metadata.driveId) || [])];

      let documentsMap = {};
      let serversMap = {};

      // Buscar documentos por ID manual E por Drive ID
      if (documentIds.length > 0 || driveIds.length > 0) {
        let query = pool.supabase
          .from('documents')
          .select('id, category, financial_document_type, server_id, title, google_drive_id');

        // Construir filtro OR (id IN (...) OR google_drive_id IN (...))
        // Supabase PostgREST syntax for OR is tricky via JS client, easiest is multiple queries or splitting logic
        // Vamos fazer duas queries para simplicidade e mergear

        const queries = [];

        if (documentIds.length > 0) {
          queries.push(pool.supabase.from('documents').select('id, category, financial_document_type, server_id, title, google_drive_id').in('id', documentIds));
        }

        if (driveIds.length > 0) {
          queries.push(pool.supabase.from('documents').select('id, category, financial_document_type, server_id, title, google_drive_id').in('google_drive_id', driveIds));
        }

        const results = await Promise.all(queries);
        const allDocs = [];

        results.forEach(r => {
          if (r.data) allDocs.push(...r.data);
          if (r.error) console.error('Erro buscando docs:', r.error);
        });

        if (allDocs.length > 0) {
          console.log('✅ [DEBUG] Documentos encontrados para enriquecimento:', allDocs.length);

          documentsMap = allDocs.reduce((acc, doc) => {
            acc[doc.id] = doc;
            if (doc.google_drive_id) {
              acc[`drive_${doc.google_drive_id}`] = doc; // Mapear também por Drive ID
            }
            return acc;
          }, {});

          // 2. Extrair IDs de servidores
          const serverIds = [...new Set(allDocs.filter(d => d.server_id).map(d => d.server_id))];

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

      // --- BUSCAR MUNICÍPIOS ---
      const municipalityCodes = [...new Set(activityLogs?.filter(a => a.municipality_code).map(a => a.municipality_code) || [])];
      let municipalitiesMap = {};

      if (municipalityCodes.length > 0) {
        const { data: municipalities, error: munError } = await pool.supabase
          .from('municipalities')
          .select('code, name')
          .in('code', municipalityCodes);

        if (!munError && municipalities) {
          municipalitiesMap = municipalities.reduce((acc, mun) => {
            acc[mun.code] = mun.name;
            return acc;
          }, {});
        }
      }

      // Formatar atividades
      const activities = (activityLogs || []).map(log => {
        const user = usersMap[log.user_id] || {};
        const metadata = log.metadata || {};
        const fileName = metadata.file_name || 'Arquivo';

        // Dados enriquecidos - Tentar ID direto OU Drive ID
        let doc = documentsMap[log.document_id];
        if (!doc && metadata.drive_file_id) {
          doc = documentsMap[`drive_${metadata.drive_file_id}`];
        }
        if (!doc && metadata.driveId) {
          doc = documentsMap[`drive_${metadata.driveId}`];
        }

        let contextInfo = metadata.context_info || ''; // Prioridade para metadados salvos
        let serverName = null;

        if (doc) {
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
              serverName = server.name;
            }
          }

          if (parts.length > 0 && !contextInfo) {
            // Only build context info if not already present from metadata
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
          municipalityCode: log.municipality_code,
          municipalityName: municipalitiesMap[log.municipality_code] || null,
          serverName: serverName
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
        .from('servers')
        .select('id, created_at, municipality_code', { count: 'exact' });

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
        .from('servers')
        .select('id', { count: 'exact' })
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