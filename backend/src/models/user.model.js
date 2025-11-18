const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Busca usuário por email
   */
  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const values = [email];
      
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por email:', error);
      throw error;
    }
  }

  /**
   * Busca usuário por ID
   */
  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const values = [id];
      
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por ID:', error);
      throw error;
    }
  }

  /**
   * Verifica se a senha está correta
   */
  static async checkPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('❌ Erro ao verificar senha:', error);
      throw error;
    }
  }

  /**
   * Cria um novo usuário
   */
  static async create(userData) {
    try {
      const { name, email, password, user_type, municipality, role } = userData;
      
      const query = `
        INSERT INTO users (name, email, password, user_type, municipality, role, active, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        RETURNING id, name, email, user_type, municipality, role, active, created_at
      `;
      
      const values = [name, email, password, user_type, municipality, role];
      
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * Busca todos os usuários
   */
  static async findAll() {
    try {
      const query = `
        SELECT id, name, email, user_type, municipality, role, active, created_at, updated_at
        FROM users 
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw error;
    }
  }
}

module.exports = User;