const Document = require('../models/document.model');
const Municipality = require('../models/municipality.model');
const Server = require('../models/server.model');
const googleDriveOAuthService = require('../services/google-drive-oauth.service');
const multer = require('multer');
const path = require('path');

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
    console.log('\n🟢 ========================================');
    console.log('🟢 [CONTROLLER] uploadFile CHAMADO!');
    console.log('🟢 ========================================');
    console.log('📋 req.body:', JSON.stringify(req.body, null, 2));
    console.log('📎 req.file:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: `${req.file.buffer ? req.file.buffer.length : 0} bytes`
    } : '❌ NENHUM ARQUIVO');
    console.log('🟢 ========================================\n');

    try {
      // Verificar se Google Drive OAuth está disponível
      if (!googleDriveOAuthService.isInitialized()) {
        console.error('❌ Google Drive OAuth NÃO está inicializado!');
        return res.status(503).json({
          success: false,
          message: 'Google Drive OAuth não está configurado'
        });
      }
      
      console.log('✅ Google Drive OAuth está inicializado');
      
      const { 
        title, description, category, municipality_code, server_id, server_name, municipality_name,
        // Novos campos para documentos financeiros
        document_type, financial_document_type, financial_year, financial_period
      } = req.body;
      const file = req.file;

      console.log('📝 Campos extraídos:', {title, description, category, municipality_code, server_id, server_name, municipality_name, document_type});

      if (!file) {
        console.error('❌ Arquivo não encontrado em req.file');
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado'
        });
      }

      console.log('✅ Arquivo presente, iniciando validações...');

      // Validações específicas por tipo de documento
      if (document_type === 'financeira') {
        console.log('📊 Documento tipo: financeira');
        if (!title || !municipality_code || !financial_document_type || !financial_year) {
          console.error('❌ Validação falhou para documento financeiro');
          return res.status(400).json({
            success: false,
            message: 'Campos obrigatórios para documento financeiro: title, municipality_code, financial_document_type, financial_year'
          });
        }
      } else {
        // Validação para documentos de servidor (padrão)
        console.log('👤 Documento tipo: servidor (padrão)');
        // Category é opcional, usar 'documento' como padrão
        const finalCategory = category || 'documento';
        console.log('📂 Category:', finalCategory);
        
        if (!title || !municipality_code || !server_id) {
          console.error('❌ Validação falhou:', {title: !!title, municipality_code: !!municipality_code, server_id: !!server_id});
          return res.status(400).json({
            success: false,
            message: 'Campos obrigatórios para documento de servidor: title, municipality_code, server_id'
          });
        }
        
        console.log('✅ Validação OK, continuando...');
      }

      // Buscar município
      const municipality = await Municipality.findByCode(municipality_code);
      if (!municipality) {
        return res.status(404).json({
          success: false,
          message: 'Município não encontrado'
        });
      }
      console.log(`📍 Município encontrado: ${municipality.name}`);

      // Verificar servidor apenas para documentos de servidor
      let server = null;
      let uploadFolderId = null;
      
      if (document_type !== 'financeira' && server_id) {
        server = await Server.findById(server_id);
        console.log(`👤 Servidor:`, server ? server.name : 'não encontrado');
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
            const folderStructure = await googleDriveOAuthService.createServerFolderStructure(
              municipality.name,
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

      // Upload para o Google Drive - usar título do documento como nome do arquivo
      const fileExtension = path.extname(file.originalname);
      const fileName = `${title}${fileExtension}`;
      console.log(`🚀 Iniciando upload: ${fileName} (título: ${title})`);
      console.log(`📂 Destino: ${municipality.name} > ${server ? server.name : 'sem servidor'}`);
      
      const driveFile = await googleDriveOAuthService.uploadFile(
        file.buffer,
        fileName,
        municipality.name,
        server.name,
        file.mimetype
      );

      console.log(`✅ Upload concluído no Google Drive: ${driveFile.googleDriveId}`);

      // Salvar no banco de dados
      const document = await Document.create({
        title,
        description: description || '',
        category: category || 'documento',
        municipality_code,
        server_id: server?.id || null,
        file_name: fileName, // Nome com o título do documento
        file_path: `https://drive.google.com/file/d/${driveFile.googleDriveId}/view`,
        file_size: file.size,
        mime_type: file.mimetype,
        google_drive_id: driveFile.googleDriveId,
        uploaded_by: req.user?.id || null
      });

      console.log(`💾 Documento salvo no banco: ID ${document.id}`);

      res.status(201).json({
        success: true,
        message: 'Documento enviado com sucesso',
        data: {
          document,
          server: server,
          driveFileId: driveFile.googleDriveId
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
      const fileStream = await googleDriveOAuthService.downloadFile(document.google_drive_id);
      
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
      await googleDriveOAuthService.deleteFile(document.google_drive_id);

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