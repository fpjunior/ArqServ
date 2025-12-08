const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');

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
 * @desc Obter estatísticas do dashboard
 * @access Public
 */
router.get('/stats', DashboardController.getDashboardStats);

module.exports = router;
