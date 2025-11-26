const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * Middleware para verificar JWT e carregar user com role/permissions
 */
exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Token não fornecido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'arqserv_secret_key');
    
    // Buscar user atualizado com role e permissões
    const { data: user, error } = await pool.supabase
      .from('users')
      .select('id, email, name, role, active')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.active) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Usuário inativo',
        code: 'USER_INACTIVE'
      });
    }

    // Carregar permissões hardcoded baseado no role
    const User = require('../models/user.model');
    const permissions = await User.getPermissionsByRole(user.role);

    req.user = {
      ...user,
      permissions: permissions
    };

    next();
  } catch (error) {
    console.error('❌ [AUTH] Erro na autenticação:', error.message);
    res.status(401).json({
      status: 'ERROR',
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Middleware para verificar se user é admin
 */
exports.requireAdmin = async (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'Acesso negado. Privilégios de administrador necessários',
      code: 'ADMIN_ONLY'
    });
  }
  next();
};

/**
 * Middleware para verificar permissão específica
 */
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user?.permissions?.includes(permission)) {
      return res.status(403).json({
        status: 'ERROR',
        message: `Acesso negado. Permissão necessária: ${permission}`,
        code: 'PERMISSION_DENIED'
      });
    }
    next();
  };
};
