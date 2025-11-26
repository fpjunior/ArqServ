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
          active, 
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
   * Busca permissões do role (hardcoded, não precisa de tabela)
   */
  static async getPermissionsByRole(role) {
    // Permissões hardcoded por role
    const permissions = {
      'admin': ['users.*', 'documents.*', 'servers.*', 'settings.*'],
      'manager': ['documents.read', 'documents.upload', 'servers.read'],
      'user': ['documents.read']
    };
    
    return permissions[role] || [];
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
   * Cria um novo usuário SOMENTE na tabela users (usado no registro público - DEPRECATED)
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
   * Cria um novo usuário tanto no Supabase Auth quanto na tabela users
   * Usado pelo admin para criar novos usuários do sistema
   */
  static async createWithAuth(userInput) {
    try {
      const { name, email, password, role = 'user' } = userInput;
      
      console.log(`📝 Criando usuário: ${email} com role: ${role}`);
      
      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await pool.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          name,
          role
        }
      });

      if (authError) {
        console.error('❌ Erro ao criar usuário no Supabase Auth:', authError);
        throw authError;
      }

      console.log('✅ Usuário criado no Supabase Auth:', authData.user.id);

      // 2. Hash da senha para salvar na tabela users
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 3. Criar registro na tabela users
      const { data: dbUser, error: dbError } = await pool.supabase
        .from('users')
        .insert([{
          name,
          email,
          password: hashedPassword,
          role,
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        }])
        .select()
        .single();

      if (dbError) {
        console.error('❌ Erro ao criar usuário na tabela users:', dbError);
        // Se falhou ao criar na tabela, tentar deletar do Auth para manter consistência
        try {
          await pool.supabase.auth.admin.deleteUser(authData.user.id);
          console.log('🔄 Rollback: Usuário removido do Supabase Auth');
        } catch (rollbackError) {
          console.error('❌ Erro no rollback:', rollbackError);
        }
        throw dbError;
      }

      console.log('✅ Usuário criado na tabela users:', dbUser.id);

      return {
        ...dbUser,
        auth_id: authData.user.id
      };
    } catch (error) {
      console.error('❌ Erro ao criar usuário completo:', error.message);
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
          role, 
          active, 
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