/**
 * Serviço para registrar e consultar logs de atividades
 * Sistema ArqServ
 */

const pool = require('../config/database');

class ActivityLogService {
    /**
     * Registrar uma atividade no sistema
     * @param {Object} params - Parâmetros da atividade
     * @param {string} params.activityType - Tipo: 'view', 'download', 'upload', 'edit', 'delete'
     * @param {number} params.documentId - ID do documento (opcional)
     * @param {number} params.userId - ID do usuário
     * @param {string} params.municipalityCode - Código do município
     * @param {Object} params.metadata - Dados extras (file_name, file_size, etc.)
     * @param {string} params.ipAddress - IP do usuário
     * @param {string} params.userAgent - User agent do navegador
     */
    static async logActivity({
        activityType,
        documentId = null,
        userId = null,
        municipalityCode = null,
        metadata = {},
        ipAddress = null,
        userAgent = null
    }) {
        try {
            console.log(`📝 [ACTIVITY] Registrando atividade: ${activityType}`);
            console.log(`📝 [ACTIVITY] Dados recebidos:`, { documentId, userId, municipalityCode, metadata });

            // Tratar documentId - se for string 'drive_xxx', não é um ID válido do banco
            let validDocumentId = null;
            if (documentId !== null && documentId !== undefined) {
                if (typeof documentId === 'number') {
                    validDocumentId = documentId;
                } else if (typeof documentId === 'string') {
                    // Se começa com 'drive_', não é um ID válido do banco
                    if (!documentId.startsWith('drive_')) {
                        const parsed = parseInt(documentId, 10);
                        if (!isNaN(parsed)) {
                            validDocumentId = parsed;
                        }
                    }
                }
            }

            console.log(`📝 [ACTIVITY] documentId tratado: ${validDocumentId}`);

            const { data, error } = await pool.supabase
                .from('activity_logs')
                .insert({
                    activity_type: activityType,
                    document_id: validDocumentId,
                    user_id: userId,
                    municipality_code: municipalityCode,
                    metadata: metadata,
                    ip_address: ipAddress,
                    user_agent: userAgent
                })
                .select()
                .single();

            if (error) {
                console.error('❌ [ACTIVITY] Erro ao registrar atividade:', error);
                // Não lançar erro para não afetar a operação principal
                return null;
            }

            console.log(`✅ [ACTIVITY] Atividade registrada: ID ${data.id}`);
            return data;
        } catch (error) {
            console.error('❌ [ACTIVITY] Erro ao registrar atividade:', error);
            // Não lançar erro para não afetar a operação principal
            return null;
        }
    }

    /**
     * Contar atividades por tipo em um período
     * @param {string} activityType - Tipo de atividade
     * @param {string} municipalityCode - Código do município (opcional)
     * @param {Date} startDate - Data inicial
     * @param {Date} endDate - Data final
     */
    static async countActivities(activityType, municipalityCode = null, startDate = null, endDate = null) {
        try {
            console.log(`📊 [ACTIVITY] Contando atividades: tipo=${activityType}, município=${municipalityCode || 'TODOS'}, desde=${startDate?.toISOString() || 'N/A'}`);

            let query = pool.supabase
                .from('activity_logs')
                .select('id', { count: 'exact' })
                .eq('activity_type', activityType);

            if (municipalityCode) {
                query = query.eq('municipality_code', municipalityCode);
            }

            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }

            if (endDate) {
                query = query.lte('created_at', endDate.toISOString());
            }

            const { count, error } = await query;

            if (error) {
                console.error('❌ [ACTIVITY] Erro ao contar atividades:', error);
                return 0;
            }

            console.log(`📊 [ACTIVITY] Resultado da contagem: ${count}`);
            return count || 0;
        } catch (error) {
            console.error('❌ [ACTIVITY] Erro ao contar atividades:', error);
            return 0;
        }
    }

    /**
     * Contar visualizações de hoje
     */
    static async countViewsToday(municipalityCode = null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.countActivities('view', municipalityCode, today);
    }

    /**
     * Contar downloads de hoje
     */
    static async countDownloadsToday(municipalityCode = null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.countActivities('download', municipalityCode, today);
    }

    /**
     * Buscar atividades recentes
     * @param {Object} options - Opções de busca
     * @param {string} options.municipalityCode - Código do município
     * @param {number} options.limit - Limite de resultados
     * @param {string[]} options.types - Tipos de atividade para filtrar
     */
    static async getRecentActivities({ municipalityCode = null, limit = 10, types = null }) {
        try {
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

            if (municipalityCode) {
                query = query.eq('municipality_code', municipalityCode);
            }

            if (types && types.length > 0) {
                query = query.in('activity_type', types);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ [ACTIVITY] Erro ao buscar atividades:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('❌ [ACTIVITY] Erro ao buscar atividades:', error);
            return [];
        }
    }
}

module.exports = ActivityLogService;
