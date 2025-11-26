const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const pool = require('../config/database');

/**
 * GET /api/admin/me
 * Retorna informações do usuário atual (debug)
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    status: 'SUCCESS',
    data: {
      user: req.user,
      isAdmin: req.user?.role === 'admin'
    }
  });
});

/**
 * GET /api/admin/users
 * Lista todos os usuários (apenas admin)
 */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({
      status: 'SUCCESS',
      data: users
    });
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao listar usuários',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/admin/users
 * Cria um novo usuário (apenas admin)
 * Cria tanto no Supabase Auth quanto na tabela users
 */
router.post('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validação
    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nome, email e senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    if (!['admin', 'user', 'manager'].includes(role)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role inválida. Deve ser: admin, user ou manager',
        code: 'INVALID_ROLE'
      });
    }

    // Verificar se email já existe
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Email já cadastrado',
        code: 'EMAIL_EXISTS'
      });
    }

    // Criar usuário (Auth + Database)
    const newUser = await User.createWithAuth({
      name,
      email,
      password,
      role
    });

    // Remover senha da resposta
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Usuário criado com sucesso',
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Erro ao criar usuário',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/admin/users/:userId/role
 * Atualiza o role de um usuário
 */
router.patch('/users/:userId/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'user', 'manager'].includes(role)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role inválida. Deve ser: admin, user ou manager',
        code: 'INVALID_ROLE'
      });
    }

    const updatedUser = await User.updateRole(userId, role);

    res.json({
      status: 'SUCCESS',
      message: `Role do usuário atualizado para: ${role}`,
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar role:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao atualizar role',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/admin/users/:userId/toggle-active
 * Ativa/desativa um usuário
 */
router.patch('/users/:userId/toggle-active', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    const updatedUser = await User.toggleActive(userId, is_active);

    res.json({
      status: 'SUCCESS',
      message: `Usuário ${is_active ? 'ativado' : 'desativado'}`,
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ Erro ao ativar/desativar usuário:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao ativar/desativar usuário',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/admin/roles
 * Lista todos os roles disponíveis
 */
router.get('/roles', authenticate, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await pool.supabase
      .from('roles')
      .select('*');

    if (error) throw error;

    res.json({
      status: 'SUCCESS',
      data: data || []
    });
  } catch (error) {
    console.error('❌ Erro ao listar roles:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao listar roles',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/admin/roles/:role/permissions
 * Lista permissões de um role
 */
router.get('/roles/:role/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;

    const { data, error } = await pool.supabase
      .from('role_permissions')
      .select('permission')
      .eq('role', role);

    if (error) throw error;

    res.json({
      status: 'SUCCESS',
      data: data?.map(p => p.permission) || []
    });
  } catch (error) {
    console.error('❌ Erro ao listar permissões:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao listar permissões',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
