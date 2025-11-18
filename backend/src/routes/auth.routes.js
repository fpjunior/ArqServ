const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

/**
 * @route POST /api/auth/login
 * @desc Login do usuário
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/register
 * @desc Cadastro de usuário
 * @access Public (pode ser mudado para Private posteriormente)
 */
router.post('/register', authController.register);

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