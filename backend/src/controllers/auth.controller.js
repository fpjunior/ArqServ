const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Função para gerar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      role: user.role,
      user_type: user.user_type,
      municipality: user.municipality
    },
    process.env.JWT_SECRET || 'arqserv_secret_key',
    { expiresIn: '24h' }
  );
};

// Função para cadastrar usuário
exports.register = async (req, res) => {
  try {
    const { name, email, password, user_type, municipality, role } = req.body;

    console.log('📝 [REGISTER] Tentativa de cadastro:', { name, email, user_type, municipality, role });

    // Validações básicas
    if (!name || !email || !password || !user_type) {
      console.log('❌ [REGISTER] Dados obrigatórios faltantes');
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nome, email, senha e tipo de usuário são obrigatórios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validar se é prefeitura e tem município
    if (user_type === 'prefeitura' && !municipality) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Município é obrigatório para usuários do tipo prefeitura',
        code: 'MUNICIPALITY_REQUIRED'
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

    // Criar usuário
    console.log('💾 [REGISTER] Criando usuário no banco...');
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      user_type,
      municipality: user_type === 'prefeitura' ? municipality : null,
      role: role || 'user' // Usar o role enviado ou 'user' como padrão
    });

    console.log('✅ [REGISTER] Usuário criado com sucesso:', { id: newUser.id, email: newUser.email });

    // Resposta de sucesso
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Usuário cadastrado com sucesso',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          user_type: newUser.user_type,
          municipality: newUser.municipality,
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

    console.log('👤 [AUTH] Usuário encontrado:', { id: user.id, email: user.email, name: user.name });

    // Verificar senha usando bcrypt.compare diretamente (igual ao lanche-go)
    console.log('🔐 [AUTH] Verificando senha...');
    console.log('🔐 [AUTH] Senha recebida:', password);
    console.log('🔐 [AUTH] Senha no banco:', user.password);
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔐 [AUTH] Resultado da comparação:', isPasswordValid);
    
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
    const token = generateToken(user);

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
          user_type: user.user_type,
          municipality: user.municipality
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