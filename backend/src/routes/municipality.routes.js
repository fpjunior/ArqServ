const express = require('express');
const MunicipalityController = require('../controllers/municipality.controller');

const router = express.Router();

/**
 * @route POST /api/municipalities
 * @desc Criar novo município
 * @access Private
 */
router.post('/', MunicipalityController.createMunicipality);

/**
 * @route GET /api/municipalities
 * @desc Listar todos os municípios
 * @access Public
 */
router.get('/', MunicipalityController.getAllMunicipalities);

/**
 * @route GET /api/municipalities/search
 * @desc Buscar municípios por nome
 * @access Public
 * @query q - Query de busca
 */
router.get('/search', MunicipalityController.searchMunicipalities);

/**
 * @route GET /api/municipalities/:code
 * @desc Buscar município por código
 * @access Public
 */
router.get('/:code', MunicipalityController.getMunicipalityByCode);

/**
 * @route PUT /api/municipalities/:code
 * @desc Atualizar município
 * @access Private
 */
router.put('/:code', MunicipalityController.updateMunicipality);

/**
 * @route DELETE /api/municipalities/:code
 * @desc Deletar município
 * @access Private
 */
router.delete('/:code', MunicipalityController.deleteMunicipality);

module.exports = router;