const express = require('express');
const ServerController = require('../controllers/server.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { 
  applyMunicipalityFilter, 
  enforceUserMunicipality,
  requireMunicipalityParam 
} = require('../middleware/municipality-filter.middleware');

const router = express.Router();

/**
 * @route GET /api/servers
 * @desc Listar todos os servidores (admins) ou servidores do município do usuário
 * @access Private - Requer autenticação
 */
router.get('/', authenticate, applyMunicipalityFilter, ServerController.getAllServers);

/**
 * @route POST /api/servers
 * @desc Criar novo servidor
 * @access Private - Requer autenticação
 */
router.post('/', authenticate, applyMunicipalityFilter, ServerController.createServer);

/**
 * @route GET /api/servers/municipality/:code
 * @desc Listar servidores por município
 * @access Private - Usuários só acessam seu município, admins acessam qualquer
 * @params code - Código do município
 * @query letter - Filtro por letra inicial (opcional)
 */
router.get('/municipality/:code', authenticate, applyMunicipalityFilter, enforceUserMunicipality, ServerController.getServersByMunicipality);

/**
 * @route GET /api/servers/municipality/:code/stats
 * @desc Obter estatísticas de servidores do município
 * @access Private - Usuários só acessam seu município, admins acessam qualquer
 */
router.get('/municipality/:code/stats', authenticate, applyMunicipalityFilter, enforceUserMunicipality, ServerController.getServerStats);

/**
 * @route GET /api/servers/search
 * @desc Buscar servidores por nome
 * @access Private - Filtrado por município do usuário
 * @query q - Query de busca
 * @query municipality_code - Filtro por município (sobrescrito pelo middleware)
 * @query letter - Filtro por letra (opcional)
 */
router.get('/search', authenticate, applyMunicipalityFilter, ServerController.searchServers);

/**
 * @route GET /api/servers/:id
 * @desc Buscar servidor por ID
 * @access Private - Filtrado por município se necessário
 */
router.get('/:id', authenticate, applyMunicipalityFilter, ServerController.getServerById);

/**
 * @route PUT /api/servers/:id
 * @desc Atualizar servidor
 * @access Private
 */
router.put('/:id', authenticate, applyMunicipalityFilter, ServerController.updateServer);

/**
 * @route DELETE /api/servers/:id
 * @desc Deletar servidor
 * @access Private
 */
router.delete('/:id', authenticate, applyMunicipalityFilter, ServerController.deleteServer);

module.exports = router;