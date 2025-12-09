const { supabase } = require('../config/database');

class Document {
  /**
   * Criar novo documento
   */
  static async create(documentData) {
    try {
      const {
        title,
        description,
        category,
        municipality_code,
        server_id,
        file_name,
        file_path,
        file_size,
        mime_type,
        google_drive_id,
        uploaded_by,
        // Campos para documentos financeiros
        financial_document_type,
        financial_year,
        financial_period
      } = documentData;

      const insertData = {
        title,
        description,
        category,
        municipality_code,
        server_id,
        file_name,
        file_path,
        file_size,
        mime_type,
        google_drive_id,
        uploaded_by,
        created_at: new Date().toISOString()
      };

      // Garantir que os campos financeiros sejam tratados corretamente
      // Adicionar campos financeiros se presentes. Validar apenas quando for um documento financeiro
      const isFinancial = (documentData.category && documentData.category.toString().toLowerCase() === 'financeiro')
        || financial_document_type;

      if (isFinancial) {
        if (!financial_document_type || !financial_year) {
          throw new Error('Campos obrigatórios para documentos financeiros estão ausentes.');
        }
        insertData.financial_document_type = financial_document_type;
        insertData.financial_year = financial_year;
        insertData.financial_period = financial_period || null;
      }

      // Remover campos undefined
      Object.keys(insertData).forEach(key => {
        if (insertData[key] === undefined) {
          delete insertData[key];
        }
      });

      console.log('📝 Dados para inserir no banco:', insertData);

      const { data, error } = await supabase
        .from('documents')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar documento:', error);
      throw error;
    }
  }

  /**
   * Buscar documentos por município
   */
  static async findByMunicipality(municipalityCode, filters = {}) {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('municipality_code', municipalityCode)
        .eq('is_active', true);

      // Filtro por categoria
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      // Filtro por data
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar documentos:', error);
      throw error;
    }
  }

  /**
   * Buscar documento por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('❌ Erro ao buscar documento:', error);
      throw error;
    }
  }

  /**
   * Buscar documentos por servidor
   */
  static async findByServer(serverId) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *
        `)
        .eq('server_id', serverId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar documentos por servidor:', error);
      throw error;
    }
  }

  /**
   * Atualizar documento
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('is_active', true)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao atualizar documento:', error);
      throw error;
    }
  }

  /**
   * Deletar documento (soft delete)
   */
  static async delete(id) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao deletar documento:', error);
      throw error;
    }
  }

  /**
   * Buscar todos os documentos (admin)
   */
  static async findAll(filters = {}) {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('is_active', true);

      // Filtros
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.municipality_code) {
        query = query.eq('municipality_code', filters.municipality_code);
      }

      query = query.order('created_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar todos os documentos:', error);
      throw error;
    }
  }

  /**
   * Buscar tipos de documentos financeiros disponíveis para um município
   */
  static async getAvailableFinancialTypes(municipalityCode, year = null) {
    try {
      console.log(`🔍 [getAvailableFinancialTypes] Municipality: ${municipalityCode}, Year: ${year}`);
      
      // SEMPRE buscar TODOS os tipos financeiros para o município (ignorar filtro de ano)
      const allTypesQuery = supabase
        .from('documents')
        .select('financial_document_type')
        .eq('municipality_code', municipalityCode)
        .eq('category', 'financeiro')
        .neq('financial_document_type', null)
        .eq('is_active', true);

      const { data: allTypes, error: allTypesError } = await allTypesQuery;

      if (allTypesError) {
        console.error('❌ Erro na consulta ao Supabase:', allTypesError);
        throw new Error('Erro ao buscar tipos financeiros no banco de dados.');
      }

      if (!allTypes || allTypes.length === 0) {
        console.warn('⚠️ Nenhum tipo financeiro encontrado.');
        return [];
      }

      // Agregar contagens por tipo no servidor (Node)
      const counts = allTypes.reduce((acc, row) => {
        const t = (row.financial_document_type || '').toString();
        if (!t) return acc;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});

      console.log(`✅ [getAvailableFinancialTypes] Tipos encontrados:`, counts);

      // Mapear os nomes para padronizar com o Google Drive
      const typeMapping = {
        'folha-pagamento': 'Folha de Pagamento',
        'despesas': 'Relatório de Despesas',
        'receitas': 'Relatório de Receitas',
        'contratos': 'Contratos',
        'licitações': 'Licitações',
        'orçamento anual': 'Orçamento Anual',
        'planejamento': 'Planejamento',
        'conformidade': 'Conformidade',
        'prestação de contas': 'Prestação de Contas'
      };

      const result = Object.keys(counts).map(key => ({
        financial_document_type: key,
        display_name: typeMapping[key] || key,
        count: counts[key]
      }));

      return result;
    } catch (error) {
      console.error('❌ Erro em getAvailableFinancialTypes:', error);
      throw error;
    }
  }

  /**
   * Deletar documento por ID
   */
  static async deleteById(id) {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar documento:', error);
      throw error;
    }
  }

  /**
   * Buscar documentos financeiros por tipo específico
   */
  static async getFinancialDocumentsByType(municipalityCode, type, year = null) {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('municipality_code', municipalityCode)
        .eq('category', 'financeiro')
        .eq('financial_document_type', type)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (year) {
        query = query.eq('financial_year', parseInt(year, 10));
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar documentos financeiros por tipo:', error);
        throw new Error('Erro ao buscar documentos no banco de dados.');
      }

      console.log(`📁 [getFinancialDocumentsByType] Municipalidade: ${municipalityCode}, Tipo: ${type}, Ano: ${year || 'todos'}`);
      console.log(`📄 Documentos encontrados: ${data?.length || 0}`);
      if (data && data.length > 0) {
        console.log(`🔑 Primeira documento:`, JSON.stringify(data[0], null, 2));
      }

      return data || [];
    } catch (error) {
      console.error('❌ Erro em getFinancialDocumentsByType:', error);
      throw error;
    }
  }
}

module.exports = Document;