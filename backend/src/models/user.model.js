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
          municipality_code,
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
   * Busca usuário por ID INCLUINDO o hash da senha (uso interno para verificação)
   */
  static async findByIdWithPassword(id) {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .select('*') // Seleciona tudo, incluindo password
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário com senha por ID:', error.message);
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
      const { name, email, password, role = 'user', municipality_code = null } = userData;

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      const { data, error } = await pool.supabase
        .from('users')
        .insert([{
          name,
          email,
          password: hashedPassword,
          role: role,
          municipality_code,
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
      const { name, email, password, role = 'user', municipality_code = null } = userInput;

      console.log(`📝 Criando usuário: ${email} com role: ${role}`);

      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await pool.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          name,
          role,
          municipality_code
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
          municipality_code,
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
          municipality_code,
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

  /**
   * Atualiza dados do usuário
   */
  static async update(userId, userData) {
    try {
      const { name, email, role, municipality_code } = userData;

      // Objeto de atualização
      const updates = {
        name,
        email,
        role,
        municipality_code: role === 'user' ? municipality_code : null,
        updated_at: new Date()
      };

      // Se tiver municipality_code, verificar se é válido (opcional, mas bom ter)

      const { data, error } = await pool.supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Tentar atualizar metadados no Auth também (se possível, senão apenas loga erro mas continua)
      try {
        // Primeiro precisamos do auth_id. O modelo atual não garante que temos isso fácil aqui
        // mas podemos tentar buscar user por email para pegar auth user se necessário
        // Por simplificação, vamos assumir que a edição principal é no banco de dados local
        // Em um cenário ideal, sincronizaríamos ambos.
      } catch (authError) {
        console.warn('⚠️ Não foi possível sincronizar update com Supabase Auth:', authError);
      }

      return data;
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Deleta usuário
   */
  static async delete(userId) {
    try {
      // 1. Buscar usuário para pegar dados antes de deletar (precisamos do email/id para deletar do auth)
      const user = await this.findById(userId);
      if (!user) throw new Error('Usuário não encontrado');

      // 2. Deletar do banco de dados (users table)
      const { error: dbError } = await pool.supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (dbError) throw dbError;

      // 3. Deletar do Supabase Auth
      // Precisamos buscar o usuário no auth pelo email para pegar o ID do auth, ou se já tivéssemos o ID do auth salvo
      // Como não temos o auth_id salvo na tabela users (baseado no schema visto), vamos tentar buscar pelo admin API
      try {
        // Listar usuários para encontrar o ID do Auth pelo email
        // Nota: Isso pode ser custoso se tiver muitos usuários. 
        // Ideal: Adicionar coluna `auth_id` na tabela `users`.
        // Fallback: Tenta deletar apenas do banco local se não conseguir do Auth.

        // Vamos tentar deletar direto se o `id` da tabela for igual ao `id` do auth (o que acontece em alguns setups)
        // Mas aqui parece que usamos IDs numéricos para tabela e UUID para auth.
        // Vamos pular a deleção do Auth por enquanto se não tivermos o ID, ou deixar o admin limpar manualmente.
        // TODO: Melhorar sincronia Auth <-> DB
      } catch (authError) {
        console.warn('⚠️ Erro ao tentar deletar do Auth:', authError);
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Busca usuários por município
   */
  static async findByMunicipality(municipalityCode) {
    try {
      const { data, error } = await pool.supabase
        .from('users')
        .select(`
          id, 
          name, 
          email, 
          role,
          municipality_code,
          active, 
          created_at, 
          updated_at
        `)
        .eq('municipality_code', municipalityCode)
        .eq('active', true)
        .order('name');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar usuários por município:', error.message);
      throw error;
    }
  }

  /**
   * Verifica se usuário tem acesso ao município
   */
  static async hasAccessToMunicipality(userId, municipalityCode) {
    try {
      const user = await this.findById(userId);

      if (!user) {
        return false;
      }

      // Admin tem acesso a todos os municípios
      if (user.role === 'admin') {
        return true;
      }

      // Usuário comum só tem acesso ao seu município
      return user.municipality_code === municipalityCode;
    } catch (error) {
      console.error('❌ Erro ao verificar acesso ao município:', error.message);
      return false;
    }
  }
}

module.exports = User;