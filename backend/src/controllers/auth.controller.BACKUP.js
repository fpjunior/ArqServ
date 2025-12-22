const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Função para gerar token JWT com role e permissões
const generateToken = async (user) => {
    // Buscar permissões do role
    const permissions = await User.getPermissionsByRole(user.role);

    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role || 'user',
            municipality_code: user.municipality_code,
            permissions: permissions
        },
        process.env.JWT_SECRET || 'arqserv_secret_key',
        { expiresIn: '24h' }
    );
};
