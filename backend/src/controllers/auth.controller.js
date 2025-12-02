const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Função para gerar token JWT com role e permissões
const generateToken = async (user) => {
  // Buscar permissões do role
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
// DEPRECATED: Use POST /api/admin/users para criar usuários através do painel admin
// Este endpoint está mantido apenas para compatibilidade com sistema legacy
// Considera-se desabilitar este endpoint em produção
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, municipality_code } = req.body;

    console.log('⚠️ [REGISTER] DEPRECATED - Use /api/admin/users. Tentativa de cadastro:', { 
      name, 
      email, 
      role, 
      municipality_code 
    });

    // Validações básicas
    if (!name || !email || !password) {
      console.log('❌ [REGISTER] Dados obrigatórios faltantes');
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nome, email e senha são obrigatórios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Se role é 'user', municipality_code é obrigatório
    if (role === 'user' && !municipality_code) {
      console.log('❌ [REGISTER] Município obrigatório para usuários tipo "user"');
      return res.status(400).json({
        status: 'ERROR',
        message: 'Município é obrigatório para usuários do tipo "user"',
        code: 'MISSING_MUNICIPALITY'
      });
    }

    // Verificar se o email já existe
    console.log('🔍 [REGISTER] Verificando se email já existe:', email);
    const existingUser = await User.findByEmail(email);
    
    if (existingUser) {
      console.log('❌ [REGISTER] Email já cadastrado:', email);
      return res.status(409).json({
        status: 'ERROR',
        message: 'Este email já está cadastrado',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // Criptografar senha
    console.log('🔐 [REGISTER] Criptografando senha...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário SOMENTE na tabela (não cria no Auth - uso legado)
    console.log('💾 [REGISTER] Criando usuário no banco...');
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user', // Usar o role enviado ou 'user' como padrão
      municipality_code: role === 'user' ? municipality_code : null
    });

    console.log('⚠️ [REGISTER] Usuário criado APENAS na tabela (sem Supabase Auth):', { 
      id: newUser.id, 
      email: newUser.email, 
      municipality_code: newUser.municipality_code 
    });

    // Resposta de sucesso
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Usuário cadastrado com sucesso',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      }
    });

  } catch (error) {
    console.error('❌ [REGISTER] Erro no cadastro:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Função para listar usuários
exports.getUsers = async (req, res) => {
  try {
    console.log('📋 [GET_USERS] Buscando lista de usuários...');

    const users = await User.findAll();
    
    console.log(`✅ [GET_USERS] ${users.length} usuários encontrados`);

    // Resposta de sucesso
    res.json({
      status: 'SUCCESS',
      message: 'Usuários recuperados com sucesso',
      data: users
    });

  } catch (error) {
    console.error('❌ [GET_USERS] Erro ao buscar usuários:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Função para realizar login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔑 [AUTH] Tentativa de login:', { email, passwordLength: password?.length });

    // Validações básicas
    if (!email || !password) {
      console.log('❌ [AUTH] Credenciais faltantes');
      return res.status(400).json({
        status: 'ERROR',
        message: 'Email e senha são obrigatórios',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Buscar usuário
    console.log('🔍 [AUTH] Buscando usuário por email:', email);
    const user = await User.findByEmail(email);
    
    if (!user) {
      console.log('❌ [AUTH] Usuário não encontrado:', email);
      return res.status(401).json({
        status: 'ERROR',
        message: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verificar se usuário está ativo
    if (!user.active) {
      console.log('❌ [AUTH] Usuário inativo:', email);
      return res.status(403).json({
        status: 'ERROR',
        message: 'Usuário inativo',
        code: 'USER_INACTIVE'
      });
    }

    console.log('👤 [AUTH] Usuário encontrado:', { id: user.id, email: user.email, role: user.role });

    // Verificar senha
    console.log('🔐 [AUTH] Verificando senha...');
    const isPasswordValid = await User.checkPassword(password, user.password);
    
    if (!isPasswordValid) {
      console.log('❌ [AUTH] Senha inválida para:', email);
      return res.status(401).json({
        status: 'ERROR',
        message: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    console.log('✅ [AUTH] Senha válida, gerando token...');

    // Gerar token JWT
    const token = await generateToken(user);

    console.log(`✅ [AUTH] Login realizado: ${user.email}`);

    // Resposta de sucesso (seguindo padrão do lanche-go)
    res.json({
      status: 'SUCCESS',
      message: 'Login realizado com sucesso',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          municipality_code: user.municipality_code
        }
      }
    });

  } catch (error) {
    console.error('❌ [AUTH] Erro no login:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Função para obter dados do usuário atual (como /auth/me)
exports.me = async (req, res) => {
  try {
    console.log('👤 [AUTH] Buscando dados do usuário atual:', req.user?.id);

    // req.user já vem do middleware authenticate com role e permissions
    const userData = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      active: req.user.active
    };

    console.log('✅ [AUTH] Dados do usuário atual:', userData);

    res.json({
      status: 'SUCCESS',
      message: 'Dados do usuário recuperados com sucesso',
      data: {
        user: userData
      }
    });

  } catch (error) {
    console.error('❌ [AUTH] Erro ao buscar dados do usuário:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};