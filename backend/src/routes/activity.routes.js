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

        await ActivityLogService.logActivity({
            activityType: 'view',
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
