const Document = require('../models/document.model');
const Municipality = require('../models/municipality.model');
const Server = require('../models/server.model');
const GoogleDriveService = require('../services/googleDrive.service');
const multer = require('multer');
const path = require('path');

// Instanciar serviço do Google Drive
const googleDriveService = new GoogleDriveService();

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas tipos de arquivo específicos
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

class DocumentController {
  /**
   * Upload de documento
   * @route POST /api/documents/upload
   */
  static uploadDocument = upload.single('file');

  static async uploadFile(req, res) {
    try {
      // Verificar se Google Drive está disponível
      await googleDriveService.ensureInitialized();
      
      const { 
        title, description, category, municipality_code, server_id, server_name, municipality_name,
        // Novos campos para documentos financeiros
        document_type, financial_document_type, financial_year, financial_period
      } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado'
        });
      }

      // Validações específicas por tipo de documento
      if (document_type === 'financeira') {
        if (!title || !municipality_code || !financial_document_type || !financial_year) {
          return res.status(400).json({
            success: false,
            message: 'Campos obrigatórios para documento financeiro: title, municipality_code, financial_document_type, financial_year'
          });
        }
      } else {
        // Validação para documentos de servidor (padrão)
        if (!title || !category || !municipality_code || !server_id) {
          return res.status(400).json({
            success: false,
            message: 'Campos obrigatórios para documento de servidor: title, category, municipality_code, server_id'
          });
        }
      }

      // Verificar servidor apenas para documentos de servidor
      let server = null;
      let uploadFolderId = null;
      
      if (document_type !== 'financeira' && server_id) {
        server = await Server.findById(server_id);
        if (!server) {
          // Se servidor não existe, tentar criar
          if (!server_name) {
            return res.status(400).json({
              success: false,
              message: 'Server não encontrado e server_name não fornecido para criação'
            });
          }

          try {
            // Criar estrutura de pastas no Google Drive
            const folderStructure = await googleDriveService.createServerFolderStructure(
              municipality_name || 'Município',
              municipality_code,
              server_name
            );

            // Criar servidor no banco
            server = await Server.create({
              name: server_name,
              municipality_code,
              drive_folder_id: folderStructure.serverFolderId
            });

            console.log(`✅ Servidor ${server_name} criado automaticamente`);
          } catch (error) {
            console.error('❌ Erro ao criar servidor:', error);
            return res.status(500).json({
              success: false,
              message: 'Erro ao criar servidor automaticamente'
            });
          }
        }
        uploadFolderId = server?.drive_folder_id;
      }

      // Upload para o Google Drive
      const fileName = `${Date.now()}_${file.originalname}`;
      const driveFile = await googleDriveService.uploadFile(
        file.buffer,
        fileName,
        file.mimetype,
        uploadFolderId
      );

      // Construir caminho hierárquico
      let hierarchical_path = '';
      
      if (document_type === 'financeira') {
        // Para documentos financeiros, criar estrutura específica
        hierarchical_path = DocumentController.buildFinancialHierarchicalPath({
          municipality_name: municipality_name || 'Município',
          financial_document_type,
          financial_year,
          financial_period
        });
      } else if (server) {
        // Para documentos de servidor, usar estrutura existente
        hierarchical_path = `${municipality_name || 'Município'} > Servidores ${server.name.charAt(0).toUpperCase()} > ${server.name}`;
      }

      // Salvar no banco de dados
      const document = await Document.create({
        title,
        description: description || '',
        category: category || 'geral',
        municipality_code,
        server_id: document_type === 'servidor' ? server?.id : null,
        file_name: file.originalname,
        file_path: `https://drive.google.com/file/d/${driveFile.id}/view`,
        file_size: file.size,
        mime_type: file.mimetype,
        google_drive_id: driveFile.id,
        uploaded_by: req.user?.id || null,
        document_type: document_type || 'servidor',
        financial_document_type,
        financial_year,
        financial_period,
        hierarchical_path
      });

      res.status(201).json({
        success: true,
        message: 'Documento enviado com sucesso',
        data: {
          document,
          server: server,
          driveFileId: driveFile.id
        }
      });

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Listar documentos por município
   * @route GET /api/documents/municipality/:code
   */
  static async getDocumentsByMunicipality(req, res) {
    try {
      const { code } = req.params;
      const { category, dateFrom, dateTo } = req.query;

      const filters = {};
      if (category) filters.category = category;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const documents = await Document.findByMunicipality(code, filters);

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

  /**
   * Buscar documento por ID
   * @route GET /api/documents/:id
   */
  static async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      const document = await Document.findById(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado'
        });
      }

      res.json({
        success: true,
        data: document
      });

    } catch (error) {
      console.error('❌ Erro ao buscar documento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Download de documento
   * @route GET /api/documents/:id/download
   */
  static async downloadDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await Document.findById(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado'
        });
      }

      // Baixar arquivo do Google Drive
      const fileStream = await googleDriveService.downloadFile(document.google_drive_id);
      
      // Configurar headers para download
      res.set({
        'Content-Type': document.mime_type,
        'Content-Disposition': `attachment; filename="${document.file_name}"`
      });

      fileStream.pipe(res);

    } catch (error) {
      console.error('❌ Erro no download:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Deletar documento
   * @route DELETE /api/documents/:id
   */
  static async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await Document.findById(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado'
        });
      }

      // Deletar do Google Drive
      await googleDriveService.deleteFile(document.google_drive_id);

      // Deletar do banco (soft delete)
      await Document.delete(id);

      res.json({
        success: true,
        message: 'Documento deletado com sucesso'
      });

    } catch (error) {
      console.error('❌ Erro ao deletar documento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Listar todos os documentos (admin)
   * @route GET /api/documents/admin/all
   */
  static async getAllDocuments(req, res) {
    try {
      const { category, municipality_code, limit } = req.query;

      const filters = {};
      if (category) filters.category = category;
      if (municipality_code) filters.municipality_code = municipality_code;
      if (limit) filters.limit = parseInt(limit);

      const documents = await Document.findAll(filters);

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

  /**
   * Listar documentos financeiros por município
   * @route GET /api/documents/financial/:municipality_code
   */
  static async getFinancialDocuments(req, res) {
    try {
      const { municipality_code } = req.params;
      const { financial_document_type, financial_year, financial_period, limit } = req.query;

      const filters = {};
      if (financial_document_type) filters.financial_document_type = financial_document_type;
      if (financial_year) filters.financial_year = parseInt(financial_year);
      if (financial_period) filters.financial_period = financial_period;
      if (limit) filters.limit = parseInt(limit);

      const documents = await Document.findFinancialDocuments(municipality_code, filters);

      res.json({
        success: true,
        data: documents
      });

    } catch (error) {
      console.error('❌ Erro ao buscar documentos financeiros:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Buscar anos disponíveis para documentos financeiros
   * @route GET /api/documents/financial/:municipality_code/years
   */
  static async getFinancialYears(req, res) {
    try {
      console.log('🔍 getFinancialYears called');
      res.json({
        success: true,
        data: [2024, 2023, 2022]
      });
    } catch (error) {
      console.error('❌ Erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno'
      });
    }
  }

  /**
   * Buscar tipos de documentos financeiros disponíveis
   * @route GET /api/documents/financial/:municipality_code/types
   */
  static async getFinancialTypes(req, res) {
    try {
      const { municipality_code } = req.params;
      const { year } = req.query;
      
      const types = await Document.getAvailableFinancialTypes(municipality_code, year);

      res.json({
        success: true,
        data: types
      });

    } catch (error) {
      console.error('❌ Erro ao buscar tipos financeiros:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Construir caminho hierárquico para documentos financeiros
   */
  static buildFinancialHierarchicalPath({ municipality_name, financial_document_type, financial_year, financial_period }) {
    let path = `${municipality_name} > Documentações Financeiras > ${financial_year}`;
    
    // Mapeamento de tipos
    const typeNames = {
      'balanco': 'Balanço Patrimonial',
      'orcamento': 'Orçamento Anual',
      'prestacao-contas': 'Prestação de Contas',
      'receitas': 'Relatório de Receitas',
      'despesas': 'Relatório de Despesas',
      'licitacoes': 'Licitações e Contratos',
      'folha-pagamento': 'Folha de Pagamento',
      'outros': 'Outros'
    };
    
    path += ` > ${typeNames[financial_document_type] || financial_document_type}`;
    
    // Adicionar período se especificado
    if (financial_period) {
      const periodNames = {
        '1': '1º Trimestre',
        '2': '2º Trimestre', 
        '3': '3º Trimestre',
        '4': '4º Trimestre',
        'semestral-1': '1º Semestre',
        'semestral-2': '2º Semestre'
      };
      
      path += ` > ${periodNames[financial_period] || financial_period}`;
    }

    return path;
  }
}

module.exports = DocumentController;