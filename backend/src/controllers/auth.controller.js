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