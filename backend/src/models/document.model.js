const pool = require('../config/database');

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
        uploaded_by
      } = documentData;

      const query = `
        INSERT INTO documents (
          title, description, category, municipality_code, server_id,
          file_name, file_path, file_size, mime_type, 
          google_drive_id, uploaded_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `;

      const values = [
        title, description, category, municipality_code, server_id,
        file_name, file_path, file_size, mime_type,
        google_drive_id, uploaded_by
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
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
      let query = `
        SELECT d.*, u.name as uploaded_by_name, m.name as municipality_name
        FROM documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        LEFT JOIN municipalities m ON d.municipality_code = m.code
        WHERE d.municipality_code = $1 AND d.is_active = true
      `;
      
      const values = [municipalityCode];
      let paramCount = 1;

      // Filtro por categoria
      if (filters.category) {
        paramCount++;
        query += ` AND d.category = $${paramCount}`;
        values.push(filters.category);
      }

      // Filtro por data
      if (filters.dateFrom) {
        paramCount++;
        query += ` AND d.created_at >= $${paramCount}`;
        values.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        paramCount++;
        query += ` AND d.created_at <= $${paramCount}`;
        values.push(filters.dateTo);
      }

      query += ` ORDER BY d.created_at DESC`;

      const result = await pool.query(query, values);
      return result.rows;
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
      const query = `
        SELECT d.*, u.name as uploaded_by_name, m.name as municipality_name
        FROM documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        LEFT JOIN municipalities m ON d.municipality_code = m.code
        WHERE d.id = $1 AND d.is_active = true
      `;

      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erro ao buscar documento:', error);
      throw error;
    }
  }

  /**
   * Atualizar documento
   */
  static async update(id, updateData) {
    try {
      const fields = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(updateData)];

      const query = `
        UPDATE documents 
        SET ${fields}, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
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
      const query = `
        UPDATE documents 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [id]);
      return result.rows[0];
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
      let query = `
        SELECT d.*, u.name as uploaded_by_name, m.name as municipality_name
        FROM documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        LEFT JOIN municipalities m ON d.municipality_code = m.code
        WHERE d.is_active = true
      `;
      
      const values = [];
      let paramCount = 0;

      // Filtros similares ao findByMunicipality
      if (filters.category) {
        paramCount++;
        query += ` AND d.category = $${paramCount}`;
        values.push(filters.category);
      }

      if (filters.municipality_code) {
        paramCount++;
        query += ` AND d.municipality_code = $${paramCount}`;
        values.push(filters.municipality_code);
      }

      query += ` ORDER BY d.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar todos os documentos:', error);
      throw error;
    }
  }
}

module.exports = Document;