const express = require('express');
const ServerController = require('../controllers/server.controller');

const router = express.Router();

/**
 * @route GET /api/servers
 * @desc Listar todos os servidores
 * @access Public
 */
router.get('/', ServerController.getAllServers);

/**
 * @route POST /api/servers
 * @desc Criar novo servidor
 * @access Private
 */
router.post('/', ServerController.createServer);

/**
 * @route GET /api/servers/municipality/:code
 * @desc Listar servidores por município
 * @access Public
 * @params code - Código do município
 * @query letter - Filtro por letra inicial (opcional)
 */
router.get('/municipality/:code', ServerController.getServersByMunicipality);

/**
 * @route GET /api/servers/municipality/:code/stats
 * @desc Obter estatísticas de servidores do município
 * @access Public
 */
router.get('/municipality/:code/stats', ServerController.getServerStats);

/**
 * @route GET /api/servers/search
 * @desc Buscar servidores por nome
 * @access Public
 * @query q - Query de busca
 * @query municipality_code - Filtro por município (opcional)
 * @query letter - Filtro por letra (opcional)
 */
router.get('/search', ServerController.searchServers);

/**
 * @route GET /api/servers/:id
 * @desc Buscar servidor por ID
 * @access Public
 */
router.get('/:id', ServerController.getServerById);

/**
 * @route PUT /api/servers/:id
 * @desc Atualizar servidor
 * @access Private
 */
router.put('/:id', ServerController.updateServer);

/**
 * @route DELETE /api/servers/:id
 * @desc Deletar servidor
 * @access Private
 */
router.delete('/:id', ServerController.deleteServer);

module.exports = router;