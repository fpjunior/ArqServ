const express = require('express');
const multer = require('multer');
const path = require('path');
const Document = require('../models/document.model');

// Configurar multer para testar (memória apenas)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

class SimpleDocumentController {
  /**
   * Upload simplificado (sem Google Drive)
   * @route POST /api/documents/upload-simple
   */
  static uploadSimple = upload.single('file');

  static async uploadFileSimple(req, res) {
    try {
      const { title, description, category = 'geral', municipality_code, server_id } = req.body;
      const file = req.file;

      console.log('📄 Upload simples:', { title, municipality_code, server_id, fileSize: file?.size });

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado'
        });
      }

      if (!title || !municipality_code || !server_id) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: title, municipality_code, server_id'
        });
      }

      // Simular salvamento (sem Google Drive)
      const document = await Document.create({
        title,
        description: description || '',
        category,
        municipality_code,
        server_id: parseInt(server_id),
        file_name: file.originalname,
        file_path: `local://uploads/${Date.now()}_${file.originalname}`,
        file_size: file.size,
        mime_type: file.mimetype,
        google_drive_id: `fake_${Date.now()}`, // ID fake para testar
        uploaded_by: req.user?.id || null
      });

      res.status(201).json({
        success: true,
        message: 'Documento enviado com sucesso (modo teste)',
        data: {
          document,
          note: 'Arquivo processado mas não salvo (teste das tabelas)',
          fileInfo: {
            name: file.originalname,
            size: file.size,
            type: file.mimetype
          }
        }
      });

    } catch (error) {
      console.error('❌ Erro no upload simples:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }

  /**
   * Listar documentos por município (simplificado)
   */
  static async getDocumentsByMunicipalitySimple(req, res) {
    try {
      const { code } = req.params;
      const documents = await Document.findByMunicipality(code);

      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('❌ Erro ao buscar documentos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = SimpleDocumentController;