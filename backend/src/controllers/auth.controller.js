const { supabase } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Função para verificar senha atual (para alteração segura)
exports.verifyPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const userId = req.user.id;

    console.log('🔐 [VERIFY_PASSWORD] Verificando senha para usuário:', userId);

    if (!currentPassword) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Senha atual é obrigatória'
      });
    }

    // Buscar usuário com password hash
    const user = await User.findByIdWithPassword(userId);

    if (!user) {
      console.log('❌ [VERIFY_PASSWORD] Usuário não encontrado');
      return res.status(404).json({
        status: 'ERROR',
        message: 'Usuário não encontrado'
      });
    }

    if (!user.password) {
      console.log('❌ [VERIFY_PASSWORD] Usuário sem senha no banco');
      return res.status(401).json({
        status: 'ERROR',
        message: 'Senha atual incorreta',
        valid: false
      });
    }

    // Verificar senha com bcrypt
    const isValid = await User.checkPassword(currentPassword, user.password);

    if (!isValid) {
      console.log('❌ [VERIFY_PASSWORD] Senha incorreta');
      return res.status(401).json({
        status: 'ERROR',
        message: 'Senha atual incorreta',
        valid: false
      });
    }

    console.log('✅ [VERIFY_PASSWORD] Senha correta!');
    res.json({
      status: 'SUCCESS',
      message: 'Senha verificada com sucesso',
      valid: true
    });

  } catch (error) {
    console.error('❌ [VERIFY_PASSWORD] Erro:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar senha',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Função para alterar a senha
exports.changePassword = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    console.log('🔐 [CHANGE_PASSWORD] Iniciando alteração de senha para:', userId);

    if (!password) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nova senha é obrigatória'
      });
    }

    // 1. Criptografar nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Atualizar no banco de dados local (tabela users)
    const { error: dbError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (dbError) {
      console.error('❌ [CHANGE_PASSWORD] Erro ao atualizar senha no banco:', dbError);
      throw new Error('Erro ao atualizar senha no banco de dados');
    }

    console.log('✅ [CHANGE_PASSWORD] Senha atualizada no banco local');

    // 3. Tentar atualizar no Supabase Auth (se o usuário existir lá)
    // Usamos o admin api para isso, pois temos a service role key configurada no supabase client
    try {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: password }
      );

      if (authError) {
        console.warn('⚠️ [CHANGE_PASSWORD] Usuário não encontrado ou erro no Supabase Auth (ignorado, sistema híbrido):', authError.message);
      } else {
        console.log('✅ [CHANGE_PASSWORD] Senha sincronizada com Supabase Auth');
      }
    } catch (err) {
      console.warn('⚠️ [CHANGE_PASSWORD] Erro ao tentar sincronizar com Supabase Auth:', err.message);
    }

    res.json({
      status: 'SUCCESS',
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('❌ [CHANGE_PASSWORD] Erro ao alterar senha:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro interno ao alterar senha',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Função para gerar token JWT com role e permissões
const generateToken = async (user) => {
  const permissions = await User.getPermissionsByRole(user.role);

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      municipality_code: user.municipality_code,
      permissions: permissions
    },
    process.env.JWT_SECRET || 'arqserv_secret_key',
    { expiresIn: '24h' }
  );
};

// Função para cadastrar usuário
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, municipality_code } = req.body;

    // Validações básicas
    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nome, email e senha são obrigatórios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (role === 'user' && !municipality_code) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Município é obrigatório para usuários do tipo "user"',
        code: 'MISSING_MUNICIPALITY'
      });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Este email já está cadastrado',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name, email, password: hashedPassword,
      role: role || 'user',
      municipality_code: role === 'user' ? municipality_code : null
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Usuário cadastrado com sucesso',
      data: { user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } }
    });

  } catch (error) {
    console.error('❌ [REGISTER] Erro no cadastro:', error);
    res.status(500).json({ status: 'ERROR', message: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  }
};

// Função para listar usuários
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ status: 'SUCCESS', message: 'Usuários recuperados com sucesso', data: users });
  } catch (error) {
    console.error('❌ [GET_USERS] Erro:', error);
    res.status(500).json({ status: 'ERROR', message: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  }
};

// Função para realizar login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔑 [AUTH] Tentativa de login:', { email, passwordLength: password?.length });

    if (!email || !password) {
      return res.status(400).json({ status: 'ERROR', message: 'Email e senha são obrigatórios', code: 'MISSING_CREDENTIALS' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ status: 'ERROR', message: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.active) {
      return res.status(403).json({ status: 'ERROR', message: 'Usuário inativo', code: 'USER_INACTIVE' });
    }

    console.log('👤 [AUTH] Usuário encontrado:', { id: user.id, email: user.email, role: user.role });

    const isPasswordValid = await User.checkPassword(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ [AUTH] Senha inválida para:', email);
      return res.status(401).json({ status: 'ERROR', message: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
    }

    console.log('✅ [AUTH] Senha válida, gerando token...');
    const token = await generateToken(user);

    res.json({
      status: 'SUCCESS',
      message: 'Login realizado com sucesso',
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, municipality_code: user.municipality_code }
      }
    });

  } catch (error) {
    console.error('❌ [AUTH] Erro no login:', error);
    res.status(500).json({ status: 'ERROR', message: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  }
};

// Função para obter dados do usuário atual
exports.me = async (req, res) => {
  try {
    const userData = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      active: req.user.active
    };

    res.json({ status: 'SUCCESS', message: 'Dados do usuário recuperados com sucesso', data: { user: userData } });

  } catch (error) {
    console.error('❌ [AUTH] Erro ao buscar dados do usuário:', error);
    res.status(500).json({ status: 'ERROR', message: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  }
};
