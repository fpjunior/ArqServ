const { supabase } = require('../config/database');

/**
 * Listar todos os tipos de documentos financeiros ativos
 */
const getAllFinancialDocumentTypes = async (req, res) => {
    try {
        console.log('📋 [FINANCIAL-TYPES] Buscando tipos de documentos financeiros...');

        const { data, error } = await supabase
            .from('financial_document_types')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('❌ [FINANCIAL-TYPES] Erro ao buscar tipos:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar tipos de documentos financeiros',
                error: error.message
            });
        }

        console.log(`✅ [FINANCIAL-TYPES] ${data.length} tipos encontrados`);

        return res.status(200).json({
            success: true,
            message: 'Tipos de documentos financeiros carregados com sucesso',
            data: data
        });

    } catch (error) {
        console.error('❌ [FINANCIAL-TYPES] Erro geral:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
};

/**
 * Criar novo tipo de documento financeiro (apenas admin)
 */
const createFinancialDocumentType = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user?.id;

        console.log('📝 [FINANCIAL-TYPES] Criando novo tipo:', { name, userId });

        // Validações
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Nome do tipo é obrigatório'
            });
        }

        // Verificar se usuário é admin
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
            console.error('❌ [FINANCIAL-TYPES] Usuário não autorizado');
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem criar tipos de documentos'
            });
        }

        // Gerar código a partir do nome
        // Ex: "Relatório de Receitas" -> "relatorio-receitas"
        const code = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
            .trim()
            .replace(/\s+/g, '-'); // Substitui espaços por hífens

        console.log('🔑 [FINANCIAL-TYPES] Código gerado:', code);

        // Verificar se código já existe
        const { data: existing } = await supabase
            .from('financial_document_types')
            .select('id')
            .eq('code', code)
            .single();

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Já existe um tipo com este nome'
            });
        }

        // Inserir novo tipo
        const { data, error } = await supabase
            .from('financial_document_types')
            .insert([{
                code,
                name: name.trim(),
                description: description?.trim() || null,
                is_active: true
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ [FINANCIAL-TYPES] Erro ao criar tipo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao criar tipo de documento',
                error: error.message
            });
        }

        console.log('✅ [FINANCIAL-TYPES] Tipo criado com sucesso:', data);

        return res.status(201).json({
            success: true,
            message: 'Tipo de documento criado com sucesso',
            data: data
        });

    } catch (error) {
        console.error('❌ [FINANCIAL-TYPES] Erro geral:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
};

/**
 * Atualizar tipo de documento financeiro (apenas admin)
 */
const updateFinancialDocumentType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;
        const userId = req.user?.id;

        console.log('✏️ [FINANCIAL-TYPES] Atualizando tipo:', { id, name, userId });

        // Verificar se usuário é admin
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem atualizar tipos de documentos'
            });
        }

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;
        if (is_active !== undefined) updates.is_active = is_active;

        const { data, error } = await supabase
            .from('financial_document_types')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ [FINANCIAL-TYPES] Erro ao atualizar tipo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao atualizar tipo de documento',
                error: error.message
            });
        }

        console.log('✅ [FINANCIAL-TYPES] Tipo atualizado com sucesso');

        return res.status(200).json({
            success: true,
            message: 'Tipo de documento atualizado com sucesso',
            data: data
        });

    } catch (error) {
        console.error('❌ [FINANCIAL-TYPES] Erro geral:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
};

/**
 * Desativar tipo de documento financeiro (soft delete - apenas admin)
 */
const deleteFinancialDocumentType = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        console.log('🗑️ [FINANCIAL-TYPES] Desativando tipo:', { id, userId });

        // Verificar se usuário é admin
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem desativar tipos de documentos'
            });
        }

        // Soft delete - apenas desativa
        const { data, error } = await supabase
            .from('financial_document_types')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ [FINANCIAL-TYPES] Erro ao desativar tipo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao desativar tipo de documento',
                error: error.message
            });
        }

        console.log('✅ [FINANCIAL-TYPES] Tipo desativado com sucesso');

        return res.status(200).json({
            success: true,
            message: 'Tipo de documento desativado com sucesso',
            data: data
        });

    } catch (error) {
        console.error('❌ [FINANCIAL-TYPES] Erro geral:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
};

module.exports = {
    getAllFinancialDocumentTypes,
    createFinancialDocumentType,
    updateFinancialDocumentType,
    deleteFinancialDocumentType
};
