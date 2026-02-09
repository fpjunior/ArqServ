const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * Middleware para verificar JWT e carregar user com role/permissions
 * Suporta tanto tokens JWT locais quanto tokens do Supabase
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

    let userId = null;
    let userEmail = null;

    // Tentar verificar como JWT local primeiro
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'arqserv_secret_key');
      userId = decoded.id;
      userEmail = decoded.email;
      console.log('✅ [AUTH] Token verificado como JWT local');
    } catch (jwtError) {
      // Se falhar, tentar verificar com o Supabase
      console.log('🔄 [AUTH] JWT local falhou, tentando Supabase...');

      try {
        const { data: { user }, error } = await pool.supabase.auth.getUser(token);

        if (error || !user) {
          console.error('❌ [AUTH] Token Supabase inválido:', error?.message);
          return res.status(401).json({
            status: 'ERROR',
            message: 'Token inválido',
            code: 'INVALID_TOKEN'
          });
        }

        userEmail = user.email;
        console.log('✅ [AUTH] Token verificado via Supabase para:', userEmail);
      } catch (supabaseError) {
        console.error('❌ [AUTH] Erro ao verificar com Supabase:', supabaseError.message);
        return res.status(401).json({
          status: 'ERROR',
          message: 'Token inválido',
          code: 'INVALID_TOKEN'
        });
      }
    }

    // Buscar user atualizado com role e permissões
    let userQuery = pool.supabase
      .from('users')
      .select('id, email, name, role, active, municipality_code');

    if (userId) {
      userQuery = userQuery.eq('id', userId);
    } else if (userEmail) {
      userQuery = userQuery.eq('email', userEmail);
    } else {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Não foi possível identificar o usuário',
        code: 'USER_NOT_IDENTIFIED'
      });
    }

    const { data: user, error } = await userQuery.single();

    if (error || !user) {
      console.error('❌ [AUTH] Usuário não encontrado no banco:', error?.message);
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
 * Middleware para verificar se user é superadmin
 */
exports.requireSuperAdmin = async (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'Acesso negado. Privilégios de super administrador necessários',
      code: 'SUPERADMIN_ONLY'
    });
  }
  next();
};

/**
 * Middleware para verificar se user é admin ou superadmin
 */
exports.requireAdminOrSuperAdmin = async (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({
      status: 'ERROR',
      message: 'Acesso negado. Privilégios de administrador necessários',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};

/**
 * Middleware para verificar se user é admin (apenas)
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
