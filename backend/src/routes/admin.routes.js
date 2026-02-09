const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin, requireAdminOrSuperAdmin, requireSuperAdmin } = require('../middleware/auth.middleware');
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
router.get('/users', authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    // Superadmin vê todos, admin não vê superadmin
    const hideSuperadmins = req.user.role !== 'superadmin';
    const users = await User.findAll(hideSuperadmins);

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
router.post('/users', authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, role, municipality_code } = req.body;
    const currentUserRole = req.user.role;

    // Validação
    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nome, email e senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    // Validar roles permitidas
    if (!['admin', 'user', 'superadmin'].includes(role)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role inválida. Deve ser: superadmin, admin ou user',
        code: 'INVALID_ROLE'
      });
    }

    // ÚNICA DIFERENÇA: Apenas superadmin pode criar admin/superadmin
    if (role === 'admin' || role === 'superadmin') {
      if (currentUserRole !== 'superadmin') {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Apenas super administradores podem criar administradores',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
    }

    // Tanto admin quanto superadmin podem criar users (com limite de 5)
    if (role === 'user') {
      const userCount = await User.countUsersByRole('user');
      if (userCount >= 5) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Limite de usuários atingido (5/5). Entre em contato com o desenvolvedor do sistema para adicionar mais usuários.',
          code: 'USER_LIMIT_REACHED'
        });
      }
    }

    // Validar municipality_code para usuários tipo 'user'
    if (role === 'user' && !municipality_code) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Código do município é obrigatório para usuários tipo "user"',
        code: 'MISSING_MUNICIPALITY'
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
      role,
      municipality_code: role === 'user' ? municipality_code : null
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

    if (!['admin', 'user', 'superadmin'].includes(role)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role inválida. Deve ser: superadmin, admin ou user',
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
 * PUT /api/admin/users/:userId
 * Atualiza dados do usuário
 */
router.put('/users/:userId', authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, municipality_code } = req.body;

    // Validação básica
    if (!name || !email || !role) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nome, email e nível de acesso são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    if (!['admin', 'user', 'superadmin'].includes(role)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role inválida',
        code: 'INVALID_ROLE'
      });
    }

    if (role === 'user' && !municipality_code) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Município é obrigatório para usuários comuns',
        code: 'MISSING_MUNICIPALITY'
      });
    }

    const updatedUser = await User.update(userId, { name, email, role, municipality_code });

    // Se a senha foi fornecida, atualizar senha
    if (req.body.password && req.body.password.trim().length >= 6) {
      await User.updatePassword(userId, req.body.password);
    }

    res.json({
      status: 'SUCCESS',
      message: 'Usuário atualizado com sucesso',
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao atualizar usuário',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Remove um usuário
 */
router.delete('/users/:userId', authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Evitar que admin se delete (opcional, mas recomendado)
    if (req.user.id == userId) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Você não pode excluir sua própria conta',
        code: 'SELF_DELETION'
      });
    }

    await User.delete(userId);

    res.json({
      status: 'SUCCESS',
      message: 'Usuário excluído com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao excluir usuário:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao excluir usuário',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/admin/users/:userId/toggle-active
 * Ativa/desativa um usuário
 */
router.patch('/users/:userId/toggle-active', authenticate, requireAdminOrSuperAdmin, async (req, res) => {
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
