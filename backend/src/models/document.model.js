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
        uploaded_by,
        // Novos campos para documentação financeira
        document_type = 'servidor',
        financial_document_type,
        financial_year,
        financial_period,
        hierarchical_path
      } = documentData;

      const query = `
        INSERT INTO documents (
          title, description, category, municipality_code, server_id,
          file_name, file_path, file_size, mime_type, 
          google_drive_id, uploaded_by, document_type, 
          financial_document_type, financial_year, financial_period, 
          hierarchical_path, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *
      `;

      const values = [
        title, description, category, municipality_code, server_id,
        file_name, file_path, file_size, mime_type,
        google_drive_id, uploaded_by, document_type,
        financial_document_type, financial_year, financial_period,
        hierarchical_path
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

  /**
   * Buscar documentos financeiros por município e filtros
   */
  static async findFinancialDocuments(municipalityCode, filters = {}) {
    try {
      let query = `
        SELECT d.*, m.name as municipality_name
        FROM documents d
        LEFT JOIN municipalities m ON d.municipality_code = m.code
        WHERE d.is_active = true 
          AND d.document_type = 'financeira'
          AND d.municipality_code = $1
      `;
      
      const values = [municipalityCode];
      let paramCount = 1;

      // Filtros específicos para documentos financeiros
      if (filters.financial_document_type) {
        paramCount++;
        query += ` AND d.financial_document_type = $${paramCount}`;
        values.push(filters.financial_document_type);
      }

      if (filters.financial_year) {
        paramCount++;
        query += ` AND d.financial_year = $${paramCount}`;
        values.push(filters.financial_year);
      }

      if (filters.financial_period) {
        paramCount++;
        query += ` AND d.financial_period = $${paramCount}`;
        values.push(filters.financial_period);
      }

      query += ` ORDER BY d.financial_year DESC, d.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar documentos financeiros:', error);
      throw error;
    }
  }

  /**
   * Buscar anos disponíveis para documentos financeiros de um município
   */
  static async getAvailableFinancialYears(municipalityCode) {
    try {
      const query = `
        SELECT DISTINCT financial_year
        FROM documents 
        WHERE municipality_code = $1 
          AND document_type = 'financeira' 
          AND financial_year IS NOT NULL
          AND is_active = true
        ORDER BY financial_year DESC
      `;

      const result = await pool.query(query, [municipalityCode]);
      return result.rows.map(row => row.financial_year);
    } catch (error) {
      console.error('❌ Erro ao buscar anos disponíveis:', error);
      throw error;
    }
  }

  /**
   * Buscar tipos de documentos financeiros disponíveis para um município
   */
  static async getAvailableFinancialTypes(municipalityCode, year = null) {
    try {
      let query = `
        SELECT DISTINCT financial_document_type, COUNT(*) as document_count
        FROM documents 
        WHERE municipality_code = $1 
          AND document_type = 'financeira' 
          AND financial_document_type IS NOT NULL
          AND is_active = true
      `;
      
      const values = [municipalityCode];
      let paramCount = 1;

      if (year) {
        paramCount++;
        query += ` AND financial_year = $${paramCount}`;
        values.push(year);
      }

      query += ` GROUP BY financial_document_type ORDER BY financial_document_type`;

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar tipos de documentos financeiros:', error);
      throw error;
    }
  }
}

module.exports = Document;