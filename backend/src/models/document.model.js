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

      // Adicionar campos financeiros se presentes
      if (financial_document_type) insertData.financial_document_type = financial_document_type;
      if (financial_year) insertData.financial_year = financial_year;
      if (financial_period) insertData.financial_period = financial_period;

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
        .select(`
          *,
          uploaded_by_name:users(name),
          municipality_name:municipalities(name)
        `)
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
        .select(`
          *,
          uploaded_by_name:users(name),
          municipality_name:municipalities(name)
        `)
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
        .select(`
          *,
          uploaded_by_name:users(name),
          municipality_name:municipalities(name)
        `)
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

  // /**
  //  * Buscar documentos financeiros por município e filtros
  //  * DESABILITADO: Colunas document_type, financial_document_type, etc não existem na tabela
  //  */
  // static async findFinancialDocuments(municipalityCode, filters = {}) {

  // /**
  //  * Buscar anos disponíveis para documentos financeiros de um município
  //  * DESABILITADO: Colunas document_type, financial_document_type, etc não existem na tabela
  //  */
  // static async getAvailableFinancialYears(municipalityCode) {

  // /**
  //  * Buscar tipos de documentos financeiros disponíveis para um município
  //  * DESABILITADO: Colunas document_type, financial_document_type, etc não existem na tabela
  //  */
  // static async getAvailableFinancialTypes(municipalityCode, year = null) {
}

module.exports = Document;