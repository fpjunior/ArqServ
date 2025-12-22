const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const AuthSupabaseController = require('../controllers/auth.supabase.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route POST /api/auth/login
 * @desc Login do usuário
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route GET /api/auth/me
 * @desc Dados do usuário autenticado
 * @access Private
 */
router.get('/me', authenticate, authController.me);

/**
 * @route POST /api/auth/verify-password
 * @desc Verificar senha atual
 * @access Private
 */
router.post('/verify-password', authenticate, authController.verifyPassword);

/**
 * @route POST /api/auth/change-password
 * @desc Alterar senha do usuário
 * @access Private
 */
router.post('/change-password', authenticate, authController.changePassword);

/**
 * @route POST /api/auth/register
 * @desc Cadastro de usuário
 * @access Public (pode ser mudado para Private posteriormente)
 */
router.post('/register', authController.register);
router.post('/supabase/sync', AuthSupabaseController.syncSupabaseUser);
router.post('/invite', AuthSupabaseController.inviteUser);

/**
 * @route GET /api/auth/users
 * @desc Listar usuários
 * @access Public (pode ser mudado para Private posteriormente)
 */
router.get('/users', authController.getUsers);

/**
 * @route GET /api/auth/test
 * @desc Teste de conexão
 * @access Public
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Rota de autenticação funcionando!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;