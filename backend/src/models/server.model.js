const pool = require('../config/database');
const supabase = pool.supabase;

class ServerModel {
  /**
   * Criar novo servidor
   */
  static async create(serverData) {
    const { name, municipality_code, drive_folder_id } = serverData;
    
    // Criar objeto de insert apenas com campos obrigatórios
    const insertData = { name };
    
    // Adicionar campos opcionais apenas se fornecidos
    if (municipality_code) insertData.municipality_code = municipality_code;
    if (drive_folder_id) insertData.drive_folder_id = drive_folder_id;
    
    const { data, error } = await supabase
      .from('servers')
      .insert([insertData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Buscar servidor por ID
   */
  static async findById(id) {
    const { data, error } = await supabase
      .from('servers')
      .select(`
        *,
        municipalities:municipality_code (
          name
        )
      `)
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    
    if (data && data.municipalities) {
      data.municipality_name = data.municipalities.name;
      delete data.municipalities;
    }
    
    return data;
  }

  /**
   * Buscar servidores por município
   */
  static async findByMunicipality(municipalityCode) {
    const { data, error } = await supabase
      .from('servers')
      .select(`
        *,
        municipalities:municipality_code (
          name
        )
      `)
      .eq('municipality_code', municipalityCode)
      .order('name');
    
    if (error) throw error;
    
    // Transform nested municipality data
    return (data || []).map(server => ({
      ...server,
      municipality_name: server.municipalities?.name,
      municipalities: undefined
    }));
  }

  /**
   * Buscar servidores por letra inicial
   */
  static async findByLetter(municipalityCode, letter) {
    const { data, error } = await supabase
      .from('servers')
      .select(`
        *,
        municipalities:municipality_code (
          name
        )
      `)
      .eq('municipality_code', municipalityCode)
      .ilike('name', `${letter}%`)
      .order('name');
    
    if (error) throw error;
    
    // Transform nested municipality data
    return (data || []).map(server => ({
      ...server,
      municipality_name: server.municipalities?.name,
      municipalities: undefined
    }));
  }

  /**
   * Buscar servidor por nome e município
   */
  static async findByNameAndMunicipality(name, municipalityCode) {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .ilike('name', name)
      .eq('municipality_code', municipalityCode)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Atualizar pasta do drive do servidor
   */
  static async updateDriveFolderId(id, driveFolderId) {
    const { data, error } = await supabase
      .from('servers')
      .update({ drive_folder_id: driveFolderId })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Listar todos os servidores
   */
  static async findAll(filters = {}) {
    let query = supabase
      .from('servers')
      .select(`
        *,
        municipalities:municipality_code (
          name
        )
      `);

    if (filters.municipality_code) {
      query = query.eq('municipality_code', filters.municipality_code);
    }

    if (filters.letter) {
      query = query.ilike('name', `${filters.letter}%`);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    query = query.order('name');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    // Transform nested municipality data
    return (data || []).map(server => ({
      ...server,
      municipality_name: server.municipalities?.name,
      municipalities: undefined
    }));
  }

  /**
   * Atualizar servidor
   */
  static async update(id, updates) {
    const { data, error } = await supabase
      .from('servers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Deletar servidor (hard delete)
   */
  static async delete(id) {
    const { data, error } = await supabase
      .from('servers')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Obter estatísticas de servidores por município
   */
  static async getStatsByMunicipality(municipalityCode) {
    const { data, error, count } = await supabase
      .from('servers')
      .select('name', { count: 'exact' })
      .eq('municipality_code', municipalityCode);
    
    if (error) throw error;
    
    // Count unique first letters
    const letters = new Set((data || []).map(s => s.name.charAt(0).toUpperCase()));
    
    return {
      total_servers: count || 0,
      letters_used: letters.size
    };
  }
}

module.exports = ServerModel;