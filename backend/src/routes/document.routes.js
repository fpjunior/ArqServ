const express = require('express');
const DocumentController = require('../controllers/document.controller');

const router = express.Router();

/**
 * @route POST /api/documents/upload
 * @desc Upload de documento com informações
 * @access Private (requer autenticação)
 */
router.post('/upload', 
  DocumentController.uploadDocument,
  DocumentController.uploadFile
);

/**
 * @route GET /api/documents/municipality/:code
 * @desc Listar documentos por município
 * @access Public
 * @params code - Código do município
 * @query category - Filtro por categoria (opcional)
 * @query dateFrom - Data inicial (opcional)
 * @query dateTo - Data final (opcional)
 */
router.get('/municipality/:code', DocumentController.getDocumentsByMunicipality);

/**
 * @route GET /api/documents/:id
 * @desc Buscar documento específico por ID
 * @access Public
 */
router.get('/:id', DocumentController.getDocumentById);

/**
 * @route GET /api/documents/:id/download
 * @desc Download de arquivo do documento
 * @access Public
 */
router.get('/:id/download', DocumentController.downloadDocument);

/**
 * @route DELETE /api/documents/:id
 * @desc Deletar documento
 * @access Private (admin)
 */
router.delete('/:id', DocumentController.deleteDocument);

/**
 * @route GET /api/documents/admin/all
 * @desc Listar todos os documentos (visão administrativa)
 * @access Private (admin only)
 * @query category - Filtro por categoria (opcional)
 * @query municipality_code - Filtro por município (opcional)
 * @query limit - Limite de resultados (opcional)
 */
router.get('/admin/all', DocumentController.getAllDocuments);

module.exports = router;