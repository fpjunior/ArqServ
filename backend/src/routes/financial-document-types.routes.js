const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
    getAllFinancialDocumentTypes,
    createFinancialDocumentType,
    updateFinancialDocumentType,
    deleteFinancialDocumentType
} = require('../controllers/financial-document-types.controller');

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/financial-document-types - Listar todos os tipos ativos
router.get('/', getAllFinancialDocumentTypes);

// POST /api/financial-document-types - Criar novo tipo (admin only)
router.post('/', createFinancialDocumentType);

// PUT /api/financial-document-types/:id - Atualizar tipo (admin only)
router.put('/:id', updateFinancialDocumentType);

// DELETE /api/financial-document-types/:id - Desativar tipo (admin only)
router.delete('/:id', deleteFinancialDocumentType);

module.exports = router;
