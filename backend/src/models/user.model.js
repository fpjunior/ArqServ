const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Busca usuário por email
   */
  static async findByEmail(email) {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por email:', error.message);
      throw error;
    }
  }

  /**
   * Busca usuário por ID com permissões
   */
  static async findById(id) {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .select(`
          id, 
          email, 
          name, 
          role, 
          user_type, 
          is_active, 
          municipality,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por ID:', error.message);
      throw error;
    }
  }

  /**
   * Busca permissões do role
   */
  static async getPermissionsByRole(role) {
    try {
      const { data, error } = await pool.supabase
        .from('role_permissions')
        .select('permission')
        .eq('role', role);

      if (error) {
        throw error;
      }
      
      return data?.map(p => p.permission) || [];
    } catch (error) {
      console.error('❌ Erro ao buscar permissões:', error.message);
      return [];
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
      const { name, email, password, role = 'user' } = userData;
      
      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { data, error } = await pool.supabase
        .from('users')
        .insert([{
          name,
          email,
          password: hashedPassword,
          role: role,
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Busca todos os usuários
   */
  static async findAll() {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .select(`
          id, 
          name, 
          email, 
          user_type, 
          municipality, 
          role, 
          is_active, 
          created_at, 
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza role/role do usuário
   */
  static async updateRole(userId, role) {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .update({ role, updated_at: new Date() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao atualizar role:', error.message);
      throw error;
    }
  }

  /**
   * Ativa/desativa usuário
   */
  static async toggleActive(userId, isActive) {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .update({ active: isActive, updated_at: new Date() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao ativar/desativar usuário:', error.message);
      throw error;
    }
  }
}

module.exports = User;