const DashboardController = require('./controllers/dashboard.controller');

router.get('/api/dashboard/stats', DashboardController.getDashboardStats);