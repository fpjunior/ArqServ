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
}

module.exports = User;