const express = require('express');
const DocumentController = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { 
  checkMunicipalityAccess, 
  filterDocumentsByUserMunicipality,
  checkUploadMunicipalityAccess 
} = require('../middleware/municipality-access.middleware');

const router = express.Router();

/**
 * @route POST /api/documents/upload
 * @desc Upload de documento com informações
 * @access Private (requer autenticação)
 */
router.post('/upload', 
  authenticate,
  checkUploadMunicipalityAccess,
  DocumentController.uploadDocument,
  DocumentController.uploadFile
);

/**
 * @route GET /api/documents/financial/:municipality_code
 * @desc Listar documentos financeiros por município
 * @access Public (com controle de acesso)
 * @params municipality_code - Código do município
 * @query financial_document_type - Tipo de documento financeiro (opcional)
 * @query financial_year - Ano do documento (opcional)
 * @query financial_period - Período do documento (opcional)
 * @query limit - Limite de resultados (opcional)
 */
router.get('/financial/:municipality_code', 
  authenticate,
  checkMunicipalityAccess,
  DocumentController.getFinancialDocuments
);

/**
 * @route GET /api/documents/financial
 * @desc Listar documentos financeiros do município vinculado ao usuário logado
 * @access Private (requer autenticação)
 */
router.get('/financial', 
  authenticate,
  DocumentController.getFinancialDocumentsByUser
);

/**
 * @route GET /api/documents/financial/:municipality_code/years
 * @desc Buscar anos disponíveis para documentos financeiros de um município
 * @access Public
 * @params municipality_code - Código do município
 */
router.get('/financial/:municipality_code/years', DocumentController.getFinancialYears);

/**
 * @route GET /api/documents/financial/:municipality_code/types
 * @desc Buscar tipos de documentos financeiros disponíveis para um município
 * @access Public
 * @params municipality_code - Código do município
 * @query year - Ano para filtrar tipos (opcional)
 */
router.get('/financial/:municipality_code/types', DocumentController.getFinancialTypes);

/**
 * @route GET /api/documents/financial/:municipality_code/type/:type
 * @desc Buscar documentos financeiros de um tipo específico
 * @access Public
 * @params municipality_code - Código do município
 * @params type - Tipo de documento financeiro
 */
router.get('/financial/:municipality_code/type/:type', DocumentController.getFinancialDocumentsByType);

/**
 * @route GET /api/documents/municipality/:code
 * @desc Listar documentos por município
 * @access Public (com controle de acesso por município)
 * @params code - Código do município
 * @query category - Filtro por categoria (opcional)
 * @query dateFrom - Data inicial (opcional)
 * @query dateTo - Data final (opcional)
 */
router.get('/municipality/:code', 
  authenticate,
  checkMunicipalityAccess,
  DocumentController.getDocumentsByMunicipality
);



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
 * @route GET /api/documents/drive/:drive_file_id/download
 * @desc Download de arquivo diretamente do Google Drive
 * @access Private (requer autenticação)
 */
router.get('/drive/:drive_file_id/download', 
  authenticate,
  DocumentController.downloadDriveFile
);

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
router.get('/admin/all', 
  authenticate,
  filterDocumentsByUserMunicipality,
  DocumentController.getAllDocuments
);

/**
 * @route GET /api/documents/financial/test  
 * @desc Teste da API financeira
 */
router.get('/financial/test', (req, res) => {
  res.json({ success: true, message: 'API financeira funcionando!' });
});

/**
 * @route GET /api/documents/financial/:municipality_code/years
 * @desc Buscar anos disponíveis para documentos financeiros
 */
router.get('/financial/:municipality_code/years', DocumentController.getFinancialYears);

/**
 * @route GET /api/documents/financial/:municipality_code/types
 * @desc Buscar tipos de documentos financeiros disponíveis
 */
router.get('/financial/:municipality_code/types', DocumentController.getFinancialTypes);

/**
 * @route GET /api/documents/financial/:municipality_code
 * @desc Listar documentos financeiros por município
 */
router.get('/financial/:municipality_code', DocumentController.getFinancialDocuments);

/**
 * @route GET /api/documents/server/:server_id  
 * @desc Buscar documentos de um servidor específico
 * @access Private
 */
router.get('/server/:server_id', 
  authenticate,
  filterDocumentsByUserMunicipality,
  DocumentController.getDocumentsByServer
);

/**
 * @route GET /api/documents/server/:server_id/files-count
 * @desc Buscar quantidade de arquivos de um servidor específico
 * @access Private
 */
router.get('/server/:server_id/files-count', 
  authenticate,
  filterDocumentsByUserMunicipality,
  DocumentController.getFilesCountByServer
);

/**
 * @route GET /api/documents/drive/:fileId/download
 * @desc Download de arquivo do Google Drive
 * @access Private
 */
router.get('/drive/:fileId/download',
  authenticate,
  DocumentController.downloadDriveFile
);

module.exports = router;