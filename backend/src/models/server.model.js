const pool = require('../config/database');

class ServerModel {
  /**
   * Criar novo servidor
   */
  static async create(serverData) {
    const { name, municipality_code, drive_folder_id } = serverData;
    
    const query = `
      INSERT INTO servers (name, municipality_code, drive_folder_id, created_at) 
      VALUES ($1, $2, $3, NOW()) 
      RETURNING *
    `;
    
    const values = [name, municipality_code, drive_folder_id];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Buscar servidor por ID
   */
  static async findById(id) {
    const query = `
      SELECT s.*, m.name as municipality_name
      FROM servers s
      LEFT JOIN municipalities m ON s.municipality_code = m.code
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Buscar servidores por município
   */
  static async findByMunicipality(municipalityCode) {
    const query = `
      SELECT s.*, m.name as municipality_name
      FROM servers s
      LEFT JOIN municipalities m ON s.municipality_code = m.code
      WHERE s.municipality_code = $1 AND s.deleted_at IS NULL
      ORDER BY s.name
    `;
    
    const result = await pool.query(query, [municipalityCode]);
    return result.rows;
  }

  /**
   * Buscar servidores por letra inicial
   */
  static async findByLetter(municipalityCode, letter) {
    const query = `
      SELECT s.*, m.name as municipality_name
      FROM servers s
      LEFT JOIN municipalities m ON s.municipality_code = m.code
      WHERE s.municipality_code = $1 
        AND UPPER(LEFT(s.name, 1)) = UPPER($2)
        AND s.deleted_at IS NULL
      ORDER BY s.name
    `;
    
    const result = await pool.query(query, [municipalityCode, letter]);
    return result.rows;
  }

  /**
   * Buscar servidor por nome e município
   */
  static async findByNameAndMunicipality(name, municipalityCode) {
    const query = `
      SELECT * FROM servers 
      WHERE LOWER(name) = LOWER($1) 
        AND municipality_code = $2 
        AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [name, municipalityCode]);
    return result.rows[0];
  }

  /**
   * Atualizar pasta do drive do servidor
   */
  static async updateDriveFolderId(id, driveFolderId) {
    const query = `
      UPDATE servers 
      SET drive_folder_id = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    
    const result = await pool.query(query, [driveFolderId, id]);
    return result.rows[0];
  }

  /**
   * Listar todos os servidores
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT s.*, m.name as municipality_name
      FROM servers s
      LEFT JOIN municipalities m ON s.municipality_code = m.code
      WHERE s.deleted_at IS NULL
    `;
    
    const values = [];
    let valueIndex = 1;

    if (filters.municipality_code) {
      query += ` AND s.municipality_code = $${valueIndex}`;
      values.push(filters.municipality_code);
      valueIndex++;
    }

    if (filters.letter) {
      query += ` AND UPPER(LEFT(s.name, 1)) = UPPER($${valueIndex})`;
      values.push(filters.letter);
      valueIndex++;
    }

    if (filters.search) {
      query += ` AND LOWER(s.name) LIKE LOWER($${valueIndex})`;
      values.push(`%${filters.search}%`);
      valueIndex++;
    }

    query += ` ORDER BY s.name`;

    if (filters.limit) {
      query += ` LIMIT $${valueIndex}`;
      values.push(filters.limit);
    }

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Atualizar servidor
   */
  static async update(id, updates) {
    const setClause = [];
    const values = [];
    let valueIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClause.push(`${key} = $${valueIndex}`);
      values.push(value);
      valueIndex++;
    }

    const query = `
      UPDATE servers 
      SET ${setClause.join(', ')}, updated_at = NOW() 
      WHERE id = $${valueIndex} 
      RETURNING *
    `;
    
    values.push(id);
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Deletar servidor (soft delete)
   */
  static async delete(id) {
    const query = `
      UPDATE servers 
      SET deleted_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Obter estatísticas de servidores por município
   */
  static async getStatsByMunicipality(municipalityCode) {
    const query = `
      SELECT 
        COUNT(*) as total_servers,
        COUNT(DISTINCT UPPER(LEFT(name, 1))) as letters_used
      FROM servers 
      WHERE municipality_code = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [municipalityCode]);
    return result.rows[0];
  }
}

module.exports = ServerModel;