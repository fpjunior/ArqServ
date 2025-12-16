const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route GET /api/dashboard/test
 * @desc Teste do endpoint dashboard
 * @access Public
 */
router.get('/test', (req, res) => {
  console.log('🔵 [TEST] Endpoint de teste chamado');
  res.json({
    success: true,
    message: 'Dashboard test endpoint working',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /api/dashboard/stats
 * @desc Obter estatísticas do dashboard (filtradas por município se for user)
 * @access Private (Requer autenticação)
 */
router.get('/stats', authenticate, DashboardController.getDashboardStats);

/**
 * @route GET /api/dashboard/recent-activities
 * @desc Obter atividades recentes do dashboard
 * @access Private (Requer autenticação)
 * @query limit - Número máximo de atividades (default: 10)
 */
router.get('/recent-activities', authenticate, DashboardController.getRecentActivities);

/**
 * @route GET /api/dashboard/recent-documents
 * @desc Obter documentos acessados recentemente (únicos)
 * @access Private (Requer autenticação)
 * @query limit - Número máximo de documentos (default: 6)
 */
router.get('/recent-documents', authenticate, DashboardController.getRecentDocuments);

module.exports = router;
