const pool = require('../config/database');

class Municipality {
  /**
   * Buscar todos os municípios
   */
  static async findAll() {
    try {
      const query = `
        SELECT * FROM municipalities 
        WHERE is_active = true 
        ORDER BY name
      `;

      const result = await pool.query(query);
      return result.rows;
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
      const query = `
        SELECT * FROM municipalities 
        WHERE code = $1 AND is_active = true
      `;

      const result = await pool.query(query, [code]);
      return result.rows[0] || null;
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

      const query = `
        INSERT INTO municipalities (code, name, state, drive_folder_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const values = [code, name, state, drive_folder_id];
      const result = await pool.query(query, values);

      return result.rows[0];
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
      const fields = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [code, ...Object.values(updateData)];

      const query = `
        UPDATE municipalities 
        SET ${fields}, updated_at = NOW()
        WHERE code = $1 AND is_active = true
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
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
      const query = `
        UPDATE municipalities 
        SET drive_folder_id = $2, updated_at = NOW()
        WHERE code = $1 AND is_active = true
        RETURNING *
      `;

      const result = await pool.query(query, [code, driveFolderId]);
      return result.rows[0];
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
      const query = `
        SELECT * FROM municipalities 
        WHERE state = $1 AND is_active = true 
        ORDER BY name
      `;

      const result = await pool.query(query, [state]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar municípios por estado:', error);
      throw error;
    }
  }
}

module.exports = Municipality;