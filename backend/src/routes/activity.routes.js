const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const ActivityLogService = require('../services/activity-log.service');

const router = express.Router();

/**
 * @route POST /api/activities/view
 * @desc Registrar visualização de documento
 * @access Private
 */
router.post('/view', authenticate, async (req, res) => {
    try {
        const { documentId, driveFileId, fileName, municipalityCode } = req.body;

        console.log('👁️ [ACTIVITY] Registrando visualização:', { documentId, driveFileId, fileName });

        // Buscar detalhes para contexto (denormalização)
        let contextInfo = '';
        if (documentId) {
            try {
                console.log('🔍 [ACTIVITY] Buscando contexto para docId:', documentId);
                const Document = require('../models/document.model');
                const Server = require('../models/server.model');

                let doc = null;
                // Verificar se o ID é do Google Drive (formato drive_XXX)
                if (documentId && typeof documentId === 'string' && documentId.startsWith('drive_')) {
                    const driveId = documentId.replace('drive_', '');
                    console.log(`🔍 [ACTIVITY] Buscando documento por Drive ID: ${driveId}`);
                    doc = await Document.findByGoogleDriveId(driveId);

                    if (doc) {
                        console.log(`✅ [ACTIVITY] Documento mapeado: Drive ID ${driveId} -> DB ID ${doc.id}`);
                        // Atualizar documentId para o ID real do banco
                        documentId = doc.id;
                    } else {
                        console.log(`⚠️ [ACTIVITY] Documento com Drive ID ${driveId} não encontrado no banco.`);
                    }
                } else {
                    // ID normal (inteiro)
                    doc = await Document.findById(documentId);
                }

                if (doc) {
                    console.log('✅ [ACTIVITY] Documento encontrado:', doc.id);
                    if (doc.category === 'financeiro' || doc.financial_document_type) {
                        contextInfo = ` • ${doc.financial_document_type || 'Financeiro'}`;
                    } else if (doc.server_id) {
                        const server = await Server.findById(doc.server_id);
                        if (server) {
                            contextInfo = ` • ${server.name}`;
                            console.log('✅ [ACTIVITY] Servidor encontrado para contexto:', server.name);
                        }
                    }
                } else {
                    console.log('⚠️ [ACTIVITY] Documento não encontrado no DB para ID:', documentId);
                }
            } catch (err) {
                console.error('⚠️ [ACTIVITY] Erro ao buscar contexto do documento:', err.message);
            }
        }

        await ActivityLogService.logActivity({
            activityType: 'view',
            documentId: documentId || null,
            userId: req.user?.id || null,
            municipalityCode: municipalityCode || req.user?.municipality_code || null,
            metadata: {
                drive_file_id: driveFileId,
                file_name: fileName,
                context_info: contextInfo
            },
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Visualização registrada'
        });

    } catch (error) {
        console.error('❌ [ACTIVITY] Erro ao registrar visualização:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao registrar visualização'
        });
    }
});

/**
 * @route POST /api/activities/download
 * @desc Registrar download de documento (alternativa ao registro inline)
 * @access Private
 */
router.post('/download', authenticate, async (req, res) => {
    try {
        const { documentId, driveFileId, fileName, municipalityCode } = req.body;

        console.log('⬇️ [ACTIVITY] Registrando download:', { documentId, driveFileId, fileName });

        await ActivityLogService.logActivity({
            activityType: 'download',
            documentId: documentId || null,
            userId: req.user?.id || null,
            municipalityCode: municipalityCode || req.user?.municipality_code || null,
            metadata: {
                drive_file_id: driveFileId,
                file_name: fileName
            },
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Download registrado'
        });

    } catch (error) {
        console.error('❌ [ACTIVITY] Erro ao registrar download:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao registrar download'
        });
    }
});

module.exports = router;
