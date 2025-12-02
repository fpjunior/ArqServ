const User = require('../models/user.model');

/**
 * Middleware para verificar acesso por município
 * Admins têm acesso a todos os municípios
 * Users só têm acesso ao seu município específico
 */
const checkMunicipalityAccess = async (req, res, next) => {
  try {
    // Se não há usuário autenticado, permitir (endpoints públicos)
    if (!req.user) {
      return next();
    }

    const { municipality_code } = req.params;
    const userId = req.user.id;

    // Se não há município na rota, prosseguir
    if (!municipality_code) {
      return next();
    }

    console.log(`🏛️ [ACCESS] Verificando acesso ao município ${municipality_code} para usuário ${userId}`);

    // Buscar dados do usuário
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ [ACCESS] Usuário não encontrado');
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Admin tem acesso a todos os municípios
    if (user.role === 'admin') {
      console.log('✅ [ACCESS] Admin - acesso liberado para todos os municípios');
      return next();
    }

    // Usuário comum só pode acessar seu próprio município
    if (user.municipality_code !== municipality_code) {
      console.log(`❌ [ACCESS] Usuário ${userId} tentou acessar município ${municipality_code}, mas só tem acesso a ${user.municipality_code}`);
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não tem permissão para acessar este município',
        code: 'ACCESS_DENIED_MUNICIPALITY'
      });
    }

    console.log(`✅ [ACCESS] Usuário ${userId} tem acesso ao município ${municipality_code}`);
    next();

  } catch (error) {
    console.error('❌ [ACCESS] Erro ao verificar acesso ao município:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para filtrar documentos por município do usuário
 * Modifica a query/params para incluir apenas o município permitido
 */
const filterDocumentsByUserMunicipality = async (req, res, next) => {
  try {
    // Se não há usuário autenticado, permitir (endpoints públicos)
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;

    // Buscar dados do usuário
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Admin pode ver documentos de todos os municípios - não filtrar
    if (user.role === 'admin') {
      console.log('✅ [FILTER] Admin - sem filtros de município');
      return next();
    }

    // Para usuários comuns, forçar filtro por seu município
    if (user.municipality_code) {
      // Se há municipality_code nos params, verificar se coincide
      if (req.params.municipality_code && req.params.municipality_code !== user.municipality_code) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado ao município solicitado',
          code: 'ACCESS_DENIED_MUNICIPALITY'
        });
      }

      // Forçar municipality_code no filtro de query
      req.query.municipality_code = user.municipality_code;
      console.log(`🔒 [FILTER] Usuário ${userId} limitado ao município ${user.municipality_code}`);
    }

    next();

  } catch (error) {
    console.error('❌ [FILTER] Erro ao filtrar por município:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para verificar upload por município
 * Usuários só podem fazer upload para seu município
 */
const checkUploadMunicipalityAccess = async (req, res, next) => {
  try {
    // Se não há usuário autenticado, negar
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const { municipality_code } = req.body;
    const userId = req.user.id;

    // Buscar dados do usuário
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Admin pode fazer upload em qualquer município
    if (user.role === 'admin') {
      console.log('✅ [UPLOAD] Admin - upload liberado para qualquer município');
      return next();
    }

    // Usuário comum só pode fazer upload no seu município
    if (!user.municipality_code) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não tem município associado',
        code: 'NO_MUNICIPALITY_ASSIGNED'
      });
    }

    if (municipality_code && municipality_code !== user.municipality_code) {
      console.log(`❌ [UPLOAD] Usuário ${userId} tentou upload no município ${municipality_code}, mas só pode no ${user.municipality_code}`);
      return res.status(403).json({
        success: false,
        message: `Você só pode fazer upload de documentos para o município ${user.municipality_code}`,
        code: 'UPLOAD_ACCESS_DENIED'
      });
    }

    // Se municipality_code não foi especificado, usar o do usuário
    if (!municipality_code) {
      req.body.municipality_code = user.municipality_code;
      console.log(`📁 [UPLOAD] Definindo município automaticamente: ${user.municipality_code}`);
    }

    console.log(`✅ [UPLOAD] Usuário ${userId} autorizado para upload no município ${user.municipality_code}`);
    next();

  } catch (error) {
    console.error('❌ [UPLOAD] Erro ao verificar acesso de upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  checkMunicipalityAccess,
  filterDocumentsByUserMunicipality,
  checkUploadMunicipalityAccess
};