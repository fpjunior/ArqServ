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

  /**
   * Gerar código único para município
   * Formato: primeiras letras do nome + timestamp
   */
  static async generateUniqueCode(name, state) {
    try {
      // Criar código base: primeiras 4 letras do nome (sem acentos) + 2 letras do estado
      const nameClean = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z]/g, '')
        .toUpperCase();
      
      const prefix = nameClean.substring(0, 4).padEnd(4, 'X');
      const stateCode = state.toUpperCase();
      
      // Tentar encontrar um código único
      let attempts = 0;
      let code;
      
      while (attempts < 100) {
        // Gerar sufixo baseado em timestamp + random
        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        code = `${prefix}${stateCode}${timestamp}${random}`;
        
        // Verificar se código já existe
        const existing = await this.findByCode(code);
        if (!existing) {
          return code;
        }
        
        attempts++;
      }
      
      // Fallback: usar timestamp completo
      return `${prefix}${stateCode}${Date.now()}`;
    } catch (error) {
      console.error('❌ Erro ao gerar código único:', error);
      // Fallback simples
      return `MUN${Date.now()}`;
    }
  }
}

module.exports = Municipality;