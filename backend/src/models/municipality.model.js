const { supabase } = require('../config/database');

class Municipality {
  /**
   * Buscar todos os municípios
   */
  static async findAll() {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar municípios:', error);
      throw error;
    }
  }

  /**
   * Buscar município por código
   */
  static async findByCode(code) {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .eq('code', code)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data || null;
    } catch (error) {
      console.error('❌ Erro ao buscar município:', error);
      throw error;
    }
  }

  /**
   * Criar novo município
   */
  static async create(municipalityData) {
    try {
      const { code, name, state, drive_folder_id } = municipalityData;

      const { data, error } = await supabase
        .from('municipalities')
        .insert([{
          code,
          name,
          state,
          drive_folder_id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar município:', error);
      throw error;
    }
  }

  /**
   * Atualizar município
   */
  static async update(code, updateData) {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('code', code)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao atualizar município:', error);
      throw error;
    }
  }

  /**
   * Atualizar ID da pasta do Google Drive
   */
  static async updateDriveFolderId(code, driveFolderId) {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .update({
          drive_folder_id: driveFolderId,
          updated_at: new Date().toISOString()
        })
        .eq('code', code)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao atualizar pasta do Drive:', error);
      throw error;
    }
  }

  /**
   * Buscar municípios por estado
   */
  static async findByState(state) {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .eq('state', state)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar municípios por estado:', error);
      throw error;
    }
  }
}

module.exports = Municipality;