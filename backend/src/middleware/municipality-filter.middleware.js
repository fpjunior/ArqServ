/**
 * Middleware para filtrar dados baseado no município do usuário
 * 
 * Para usuários tipo 'user': filtra dados apenas do seu município
 * Para usuários tipo 'admin': permite acesso a todos os dados
 */

/**
 * Middleware que verifica e aplica filtro de município baseado no usuário logado
 */
function applyMunicipalityFilter(req, res, next) {
  try {
    // Se não há usuário autenticado, continuar (será tratado pelo middleware de auth)
    if (!req.user) {
      return next();
    }

    console.log(`🔍 [MUNICIPALITY FILTER] User: ${req.user.email}, Role: ${req.user.role}, Municipality: ${req.user.municipality_code}`);

    // Se for admin ou superadmin, permitir acesso a todos os dados
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      console.log('👑 [ADMIN ACCESS] Acesso completo liberado para admin/superadmin');
      req.municipalityFilter = null; // null = sem filtro
      return next();
    }

    // Se for user, aplicar filtro do município
    if (req.user.role === 'user') {
      if (!req.user.municipality_code) {
        console.error('❌ [MUNICIPALITY FILTER] Usuário não tem município definido');
        return res.status(400).json({
          success: false,
          message: 'Usuário não tem município definido',
          code: 'NO_MUNICIPALITY'
        });
      }

      console.log(`🏛️ [MUNICIPALITY FILTER] Aplicando filtro para município: ${req.user.municipality_code}`);
      req.municipalityFilter = req.user.municipality_code;
      return next();
    }

    // Para outros tipos de usuário, negar acesso por segurança
    console.warn(`⚠️ [MUNICIPALITY FILTER] Role não reconhecido: ${req.user.role}`);
    return res.status(403).json({
      success: false,
      message: 'Tipo de usuário não tem permissão para acessar estes dados',
      code: 'INSUFFICIENT_PERMISSIONS'
    });

  } catch (error) {
    console.error('❌ [MUNICIPALITY FILTER] Erro no middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

/**
 * Middleware específico para endpoints de servidores
 * Força o uso do município do usuário nos parâmetros da requisição
 */
function enforceUserMunicipality(req, res, next) {
  try {
    // Se não há filtro (admin), permitir continuar
    if (!req.municipalityFilter) {
      return next();
    }

    // Para usuários normais, sobrescrever o parâmetro do município com o do usuário
    if (req.params.code && req.params.code !== req.municipalityFilter) {
      console.log(`🚫 [MUNICIPALITY ENFORCE] Tentativa de acesso a município ${req.params.code} negada. Redirecionando para ${req.municipalityFilter}`);
      req.params.code = req.municipalityFilter;
    }

    // Se há query de municipality_code, sobrescrever também
    if (req.query.municipality_code) {
      req.query.municipality_code = req.municipalityFilter;
    }

    next();
  } catch (error) {
    console.error('❌ [MUNICIPALITY ENFORCE] Erro no middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

/**
 * Middleware para endpoints que devem sempre filtrar por município
 * Se o usuário é admin mas não especificou município, retorna erro
 */
function requireMunicipalityParam(req, res, next) {
  try {
    const municipalityCode = req.params.code || req.query.municipality_code || req.municipalityFilter;

    if (!municipalityCode) {
      return res.status(400).json({
        success: false,
        message: 'Código do município é obrigatório',
        code: 'MUNICIPALITY_REQUIRED'
      });
    }

    // Adicionar município nos parâmetros se não existir
    if (!req.params.code) {
      req.params.code = municipalityCode;
    }

    next();
  } catch (error) {
    console.error('❌ [REQUIRE MUNICIPALITY] Erro no middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

module.exports = {
  applyMunicipalityFilter,
  enforceUserMunicipality,
  requireMunicipalityParam
};