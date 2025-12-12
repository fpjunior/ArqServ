const Document = require('../models/document.model');
const Municipality = require('../models/municipality.model');
const Server = require('../models/server.model');
const { supabase } = require('../config/database');
const googleDriveOAuthService = require('../services/google-drive-oauth.service');
const ActivityLogService = require('../services/activity-log.service');
const multer = require('multer');
const path = require('path');

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
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
        upload_type, financial_document_type, financial_year, financial_period
      } = req.body;
      const file = req.file;

      console.log('📝 Campos extraídos:', { title, description, category, municipality_code, server_id, server_name, municipality_name, upload_type, financial_document_type, financial_year, financial_period });

      if (!file) {
        console.error('❌ Arquivo não encontrado em req.file');
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado'
        });
      }

      console.log('✅ Arquivo presente, iniciando validações...');
      console.log('🔍 Upload type detectado:', upload_type);

      // Validações específicas por tipo de documento
      if (upload_type === 'financeiras') {
        console.log('📊 Documento tipo: financeiras - validando campos obrigatórios...');
        console.log('📋 Campos financeiros:', {
          title: !!title,
          municipality_code: !!municipality_code,
          financial_document_type: !!financial_document_type,
          financial_year: !!financial_year
        });

        if (!title || !municipality_code || !financial_document_type || !financial_year) {
          console.error('❌ Validação falhou para documento financeiro');
          return res.status(400).json({
            success: false,
            message: 'Campos obrigatórios para documento financeiro: title, municipality_code, financial_document_type, financial_year'
          });
        }
        console.log('✅ Validação financeira passou');
      } else {
        // Validação para documentos de servidor (padrão)
        console.log('👤 Documento tipo: servidor (padrão)');
        // Category é opcional, usar 'documento' como padrão
        const finalCategory = category || 'documento';
        console.log('📂 Category:', finalCategory);

        if (!title || !municipality_code || !server_id) {
          console.error('❌ Validação falhou:', { title: !!title, municipality_code: !!municipality_code, server_id: !!server_id });
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

      if (upload_type !== 'financeiras' && server_id) {
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

      let driveFile;

      if (upload_type === 'financeiras') {
        console.log(`📂 Destino: ${municipality.name} > Documentações Financeiras > ${financial_document_type}`);
        console.log('💰 Chamando uploadFinancialDocument...');

        // Upload para documentos financeiros - criar estrutura hierárquica
        driveFile = await googleDriveOAuthService.uploadFinancialDocument(
          file.buffer,
          fileName,
          municipality.name,
          financial_document_type,
          financial_year,
          financial_period,
          file.mimetype
        );
        console.log('✅ uploadFinancialDocument concluído:', driveFile.googleDriveId);
      } else {
        console.log(`📂 Destino: ${municipality.name} > ${server ? server.name : 'sem servidor'}`);
        console.log('👤 Chamando uploadFile para servidor...');

        // Upload para documentos de servidor (método existente)
        driveFile = await googleDriveOAuthService.uploadFile(
          file.buffer,
          fileName,
          municipality.name,
          server.name,
          file.mimetype
        );
        console.log('✅ uploadFile concluído:', driveFile.googleDriveId);
      }

      console.log(`✅ Upload concluído no Google Drive: ${driveFile.googleDriveId}`);

      // Salvar no banco de dados
      const documentData = {
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
      };

      // Adicionar campos específicos para documentos financeiros
      if (upload_type === 'financeiras') {
        console.log('💰 Adicionando campos financeiros ao documento...');
        documentData.financial_document_type = financial_document_type;
        documentData.financial_year = parseInt(financial_year);
        if (financial_period) {
          documentData.financial_period = financial_period;
        }
        documentData.category = 'financeiro';
        console.log('📋 Dados financeiros adicionados:', {
          financial_document_type,
          financial_year: parseInt(financial_year),
          financial_period,
          category: 'financeiro'
        });
      }

      console.log('💾 Criando documento no banco com dados:', documentData);
      const document = await Document.create(documentData);

      console.log(`💾 Documento salvo no banco: ID ${document.id}`);

      // Construir contexto para o log
      let contextInfo = '';
      if (upload_type === 'financeiras') {
        contextInfo = ` • ${financial_document_type || 'Financeiro'}`;
      } else if (server) {
        contextInfo = ` • ${server.name}`;
      }

      // Registrar atividade de upload
      await ActivityLogService.logActivity({
        activityType: 'upload',
        documentId: document.id,
        userId: req.user?.id || null,
        municipalityCode: municipality_code,
        metadata: {
          file_name: fileName,
          file_size: file.size,
          mime_type: file.mimetype,
          drive_file_id: driveFile.googleDriveId,
          context_info: contextInfo
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent')
      });
      console.log('📝 Atividade de upload registrada no activity_logs');

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
   * Listar documentos por servidor
   * @route GET /api/documents/server/:server_id
   */
  static async getDocumentsByServer(req, res) {
    try {
      const { server_id } = req.params;
      console.log(`🔍 Buscando documentos para servidor ID: ${server_id}`);

      // Verificar se o servidor existe
      const server = await Server.findById(server_id);
      if (!server) {
        return res.status(404).json({
          success: false,
          message: 'Servidor não encontrado'
        });
      }

      console.log(`📁 Servidor encontrado: ${server.name}, Drive Folder ID: ${server.drive_folder_id}`);

      let documents = [];

      // Se o servidor NÃO tem drive_folder_id, vamos criar a pasta no Google Drive
      if (!server.drive_folder_id) {
        try {
          console.log(`🔧 Servidor sem drive_folder_id, criando estrutura no Google Drive...`);

          const googleDriveOAuthService = require('../services/google-drive-oauth.service');
          if (!googleDriveOAuthService.initialized) {
            await googleDriveOAuthService.initialize();
          }

          // Buscar município do servidor
          const municipality = await require('../models/municipality.model').findByCode(server.municipality_code);
          if (municipality) {
            console.log(`📍 Criando pasta para município: ${municipality.name}, servidor: ${server.name}`);

            // Criar estrutura de pastas no Google Drive
            const serverFolderId = await googleDriveOAuthService.getServerFolderId(
              municipality.name,
              server.name
            );

            // Atualizar servidor no banco com o drive_folder_id
            await require('../models/server.model').update(server.id, {
              drive_folder_id: serverFolderId
            });

            server.drive_folder_id = serverFolderId;
            console.log(`✅ Drive folder criado e atualizado: ${serverFolderId}`);
          }
        } catch (error) {
          console.error('❌ Erro ao criar pasta no Google Drive:', error);
        }
      }

      // Se o servidor tem drive_folder_id, buscar arquivos diretamente do Google Drive
      if (server.drive_folder_id) {
        try {
          const googleDriveOAuthService = require('../services/google-drive-oauth.service');
          if (!googleDriveOAuthService.initialized) {
            await googleDriveOAuthService.initialize();
          }

          console.log(`🔍 Buscando arquivos no Google Drive, pasta: ${server.drive_folder_id}`);

          // Usar o serviço OAuth para listar arquivos
          const driveFiles = await googleDriveOAuthService.drive.files.list({
            q: `'${server.drive_folder_id}' in parents and trashed=false`,
            fields: 'files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink)',
            orderBy: 'name'
          });

          console.log(`📁 Resposta do Google Drive:`, driveFiles.data);
          console.log(`📊 Total de arquivos encontrados: ${driveFiles.data.files?.length || 0}`);

          // Converter arquivos do Drive para formato esperado pelo frontend
          documents = (driveFiles.data.files || []).map(file => ({
            id: `drive_${file.id}`,
            title: file.name,
            file_name: file.name,
            description: `Arquivo do Google Drive - ${file.mimeType}`,
            file_size: file.size ? parseInt(file.size) : null,
            mime_type: file.mimeType,
            drive_file_id: file.id,
            drive_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            created_at: file.createdTime,
            updated_at: file.modifiedTime,
            server_id: server_id,
            server_name: server.name
          }));

          console.log(`✅ Encontrados ${documents.length} arquivos no Google Drive para servidor ${server.name}`);
        } catch (driveError) {
          console.error('❌ Erro ao buscar arquivos no Google Drive:', driveError);
          // Fallback para buscar na tabela de documentos
          documents = await Document.findByServer(server_id);
          console.log(`📋 Fallback: ${documents.length} documentos encontrados na tabela para servidor ${server.name}`);
        }
      } else {
        // Se não tem drive_folder_id, buscar na tabela de documentos
        console.log(`📋 Servidor sem drive_folder_id, buscando na tabela de documentos`);
        documents = await Document.findByServer(server_id);
        console.log(`✅ Encontrados ${documents.length} documentos na tabela para servidor ${server.name}`);
      }

      res.json({
        success: true,
        data: documents,
        server: server,
        message: `Documentos do servidor ${server.name} listados com sucesso`
      });

    } catch (error) {
      console.error('❌ Erro ao buscar documentos do servidor:', error);
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

      // Registrar atividade de visualização
      await ActivityLogService.logActivity({
        activityType: 'view',
        documentId: document.id,
        userId: req.user?.id || null,
        municipalityCode: document.municipality_code,
        metadata: {
          file_name: document.file_name,
          mime_type: document.mime_type
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent')
      });

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

      // Registrar atividade de download
      await ActivityLogService.logActivity({
        activityType: 'download',
        documentId: document.id,
        userId: req.user?.id || null,
        municipalityCode: document.municipality_code,
        metadata: {
          file_name: document.file_name,
          file_size: document.file_size,
          mime_type: document.mime_type
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent')
      });

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
    const { id } = req.params;

    try {
      // Se o ID começar com 'drive_', é um arquivo direto do Google Drive
      if (id.startsWith('drive_')) {
        const driveFileId = id.replace('drive_', '');

        try {
          if (!googleDriveOAuthService.isInitialized()) {
            await googleDriveOAuthService.initialize();
          }

          await googleDriveOAuthService.deleteFile(driveFileId);

          return res.status(200).json({
            success: true,
            message: 'Arquivo deletado com sucesso do Google Drive',
          });
        } catch (error) {
          console.error('Erro ao deletar arquivo do Google Drive:', error);
          return res.status(500).json({
            success: false,
            message: 'Erro ao deletar arquivo do Google Drive',
          });
        }
      }

      // Caso contrário, é um documento do banco de dados
      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado',
        });
      }

      // Deletar do Google Drive
      if (document.drive_file_id) {
        try {
          await googleDriveOAuthService.deleteFile(document.drive_file_id);
        } catch (error) {
          console.error('Erro ao deletar arquivo do Google Drive:', error);
          return res.status(500).json({
            success: false,
            message: 'Erro ao deletar arquivo do Google Drive',
          });
        }
      }

      // Deletar do banco de dados
      await Document.deleteById(id);

      return res.status(200).json({
        success: true,
        message: 'Documento deletado com sucesso',
      });
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao deletar documento',
      });
    }
  }

  /**
   * Deletar documento financeiro
   * @route DELETE /api/documents/financial/:id
   */
  static async deleteFinancialDocument(req, res) {
    const { id } = req.params;
    try {
      // Se o ID começar com 'drive_', é um arquivo direto do Google Drive
      if (id.startsWith('drive_')) {
        const driveFileId = id.replace('drive_', '');
        if (!googleDriveOAuthService.isInitialized()) {
          await googleDriveOAuthService.initialize();
        }
        await googleDriveOAuthService.deleteFile(driveFileId);
        return res.status(200).json({ success: true, message: 'Arquivo financeiro deletado do Google Drive' });
      }
      // Caso contrário, é um documento do banco de dados
      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ success: false, message: 'Documento financeiro não encontrado' });
      }
      if (document.google_drive_id) {
        try {
          await googleDriveOAuthService.deleteFile(document.google_drive_id);
        } catch (error) {
          return res.status(500).json({ success: false, message: 'Erro ao deletar arquivo do Google Drive' });
        }
      }
      await Document.deleteById(id);
      return res.status(200).json({ success: true, message: 'Documento financeiro deletado com sucesso' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao deletar documento financeiro' });
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
   * Buscar anos disponíveis para documentos financeiros (geral ou por tipo)
   * @route GET /api/documents/financial/:municipality_code/years
   */
  static async getFinancialYears(req, res) {
    try {
      const { municipality_code } = req.params;
      const { type } = req.query; // Tipo opcional para filtrar anos

      console.log(`🔍 getFinancialYears called for municipality='${municipality_code}', type='${type || 'all'}'`);

      let years;

      if (type) {
        // Buscar anos especificamente para o tipo
        years = await Document.getAvailableYearsForType(municipality_code, type);
      } else {
        // Buscar todos os anos (existente - fallback)
        // Idealmente deveríamos ter um método no model para isso também, mas por enquanto vamos simular ou melhorar depois
        // Para simplificar e atender a demanda imediata de "anos por tipo", focaremos no fluxo com type.
        // Se não tiver type, retornamos uma lista vazia ou genérica por enquanto, 
        // mas o foco do usuário é "Tipo > Ano".
        years = [2024, 2023, 2022]; // Mock temporário se não houver tipo, ou implementar no model
      }

      res.json({
        success: true,
        data: years
      });
    } catch (error) {
      console.error('❌ Erro em getFinancialYears:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Buscar anos disponíveis para um tipo específico de documento (Rota dedicada se necessário)
   * @route GET /api/documents/financial/:municipality_code/years/:type
   */
  static async getFinancialYearsByType(req, res) {
    try {
      const { municipality_code, type } = req.params;
      console.log(`🔍 getFinancialYearsByType called for municipality='${municipality_code}', type='${type}'`);

      const years = await Document.getAvailableYearsForType(municipality_code, type);

      res.json({
        success: true,
        data: years
      });
    } catch (error) {
      console.error('❌ Erro em getFinancialYearsByType:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
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

      // Normalizar year: aceitar string/number, enviar null se inválido
      let yearParam = null;
      if (year !== undefined && year !== null && year !== '') {
        const parsed = parseInt(year, 10);
        if (!Number.isNaN(parsed)) yearParam = parsed;
      }

      console.log(`🔍 getFinancialTypes called for municipality='${municipality_code}', year=${yearParam}`);

      let types = await Document.getAvailableFinancialTypes(municipality_code, yearParam);

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
   * Buscar documentos financeiros por tipo
   */
  static async getFinancialDocumentsByType(req, res) {
    try {
      const { municipality_code, type } = req.params;
      const { year } = req.query;

      console.log(`🔍 getFinancialDocumentsByType - municipality: ${municipality_code}, type: ${type}, year: ${year || 'all'}`);

      const documents = await Document.getFinancialDocumentsByType(municipality_code, type, year);

      console.log(`✅ Retornando ${documents.length} documentos para o frontend`);
      if (documents.length > 0) {
        console.log(`🎯 Primeira documento:`, {
          id: documents[0].id,
          title: documents[0].title,
          file_name: documents[0].file_name,
          google_drive_id: documents[0].google_drive_id,
          financial_document_type: documents[0].financial_document_type
        });
      }

      res.json({
        success: true,
        data: documents
      });

    } catch (error) {
      console.error('❌ Erro ao buscar documentos financeiros por tipo:', error);
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

  /**
   * Download de arquivo diretamente do Google Drive
   * @route GET /api/documents/drive/:drive_file_id/download
   */


  /**
   * Download de arquivo do Google Drive
   * @route GET /api/documents/drive/:fileId/download
   */
  static async downloadDriveFile(req, res) {
    try {
      let fileId = req.params.fileId || req.params.drive_file_id;

      // Sanitizar ID: remover prefixo 'drive_' se existir
      if (fileId && fileId.startsWith('drive_')) {
        console.log('🧹 [DOWNLOAD] Removendo prefixo drive_ do ID:', fileId);
        fileId = fileId.replace(/^drive_/, '');
      }

      console.log(`⬇️ Iniciando download do arquivo: ${fileId}`);

      if (!googleDriveOAuthService || !googleDriveOAuthService.isInitialized()) {
        console.log('🔄 Inicializando Google Drive OAuth...');
        await googleDriveOAuthService.initialize();
      }

      // Download do arquivo
      const downloadResult = await googleDriveOAuthService.downloadFile(fileId);

      if (!downloadResult.success) {
        return res.status(404).json({
          success: false,
          message: 'Erro ao baixar arquivo do Google Drive',
          error: downloadResult.error
        });
      }

      // Buscar o municipality_code do documento no banco de dados
      let documentMunicipalityCode = null;
      let docId = null;
      let finalContextInfo = '';

      try {
        console.log(`🔄 [DOWNLOAD] Buscando contexto para ID: ${fileId}`);
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('id, municipality_code, category, financial_document_type, server_id')
          .eq('google_drive_id', fileId)
          .single();

        if (docData && !docError) {
          docId = docData.id;
          documentMunicipalityCode = docData.municipality_code;

          // Construir contexto
          if (docData.category === 'financeiro' || docData.financial_document_type) {
            finalContextInfo = ` • ${docData.financial_document_type || 'Financeiro'}`;
          } else if (docData.server_id) {
            try {
              const server = await Server.findById(docData.server_id);
              if (server) finalContextInfo = ` • ${server.name}`;
            } catch (srvErr) {
              console.error('⚠️ [DOWNLOAD] Erro ao buscar servidor:', srvErr.message);
            }
          }
          console.log(`✅ [DOWNLOAD] Contexto encontrado: DocID ${docId}, Contexto: "${finalContextInfo}"`);
        } else {
          console.log(`⚠️ [DOWNLOAD] Documento não encontrado no banco. (Erro: ${docError?.message || 'N/A'})`);
          documentMunicipalityCode = req.user?.municipality_code || null;
        }
      } catch (lookupError) {
        console.error('❌ [DOWNLOAD] Erro no lookup do documento:', lookupError.message);
        documentMunicipalityCode = req.user?.municipality_code || null;
      }

      // Registrar atividade de download
      await ActivityLogService.logActivity({
        activityType: 'download',
        documentId: docId,
        userId: req.user?.id || null,
        municipalityCode: documentMunicipalityCode,
        metadata: {
          drive_file_id: fileId,
          file_name: downloadResult.fileName,
          file_size: downloadResult.size,
          mime_type: downloadResult.mimeType,
          context_info: finalContextInfo
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent')
      });

      // Configurar headers para download
      res.set({
        'Content-Type': downloadResult.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadResult.fileName}"`,
        'Content-Length': downloadResult.size
      });

      // Enviar o stream do arquivo
      downloadResult.stream.pipe(res);
      console.log(`✅ Download iniciado: ${downloadResult.fileName}`);

    } catch (error) {
      console.error('❌ Erro no download do Google Drive:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao fazer download do arquivo',
        error: error.message
      });
    }
  }

  /**
   * Buscar quantidade de arquivos de um servidor específico
   * @route GET /api/documents/server/:server_id/files-count
   */
  static async getFilesCountByServer(req, res) {
    try {
      const { server_id } = req.params;
      console.log(`🔍 Buscando quantidade de arquivos para servidor ID: ${server_id}`);

      // Buscar informações do servidor
      const { data: server, error: serverError } = await supabase
        .from('servers')
        .select('*')
        .eq('id', server_id)
        .single();

      if (serverError || !server) {
        console.error('❌ Servidor não encontrado:', serverError);
        return res.status(404).json({
          success: false,
          message: 'Servidor não encontrado'
        });
      }

      console.log(`📁 Servidor encontrado: ${server.name}, Drive Folder ID: ${server.drive_folder_id}`);

      // Se não tem pasta do Google Drive, tentar criar
      if (!server.drive_folder_id) {
        console.log(`🔧 Servidor sem drive_folder_id, tentando criar pasta no Google Drive...`);

        try {
          // Buscar município do servidor
          const { data: municipality } = await supabase
            .from('municipalities')
            .select('*')
            .eq('code', server.municipality_code)
            .single();

          if (municipality) {
            console.log(`📍 Município encontrado: ${municipality.name}`);

            if (!googleDriveOAuthService.isInitialized()) {
              await googleDriveOAuthService.initialize();
            }

            const serverFolderId = await googleDriveOAuthService.getServerFolderId(
              municipality.name,
              server.name
            );

            console.log(`✅ Pasta criada no Google Drive: ${serverFolderId}`);

            const { error: updateError } = await supabase
              .from('servers')
              .update({ drive_folder_id: serverFolderId })
              .eq('id', server_id);

            if (!updateError) {
              server.drive_folder_id = serverFolderId;
              console.log(`✅ Drive folder ID atualizado no banco`);
            } else {
              console.error('❌ Erro ao atualizar drive_folder_id:', updateError);
            }
          }
        } catch (createError) {
          console.error('❌ Erro ao criar pasta no Google Drive:', createError);
          return res.json({
            success: true,
            data: await Document.findByServer(server_id).then(docs => docs.length),
            message: 'Pasta ainda não criada no Google Drive. Contagem do banco utilizada.'
          });
        }
      }

      if (!server.drive_folder_id) {
        return res.json({
          success: true,
          data: await Document.findByServer(server_id).then(docs => docs.length),
          message: 'Servidor sem pasta no Google Drive configurada. Contagem do banco utilizada.'
        });
      }

      if (!googleDriveOAuthService.isInitialized()) {
        console.log('🔄 Inicializando Google Drive OAuth...');
        await googleDriveOAuthService.initialize();
      }

      try {
        const driveResponse = await googleDriveOAuthService.listFilesInFolder(server.drive_folder_id);
        console.log('📁 Resposta do Google Drive:', driveResponse);

        const filesCount = driveResponse.files ? driveResponse.files.length : 0;
        console.log(`📊 Total de arquivos encontrados: ${filesCount}`);

        res.json({
          success: true,
          data: filesCount
        });

      } catch (driveError) {
        console.error('❌ Erro ao buscar arquivos no Google Drive:', driveError);
        const fallbackCount = await Document.findByServer(server_id).then(docs => docs.length);
        console.log(`📋 Fallback: ${fallbackCount} documentos encontrados na tabela para servidor ${server.name}`);
        res.json({
          success: true,
          data: fallbackCount,
          message: 'Erro ao acessar Google Drive. Contagem do banco utilizada.'
        });
      }

    } catch (error) {
      console.error('❌ Erro ao buscar quantidade de arquivos do servidor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }

  /**
   * Listar documentos financeiros do município do usuário logado
   * @route GET /api/documents/financial
   */
  static async getFinancialDocumentsByUser(req, res) {
    try {
      const { municipality_code } = req.user; // Obter município do usuário logado

      if (!municipality_code) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não possui município vinculado'
        });
      }

      console.log(`🏢 [getFinancialDocumentsByUser] Buscando tipos financeiros para município: ${municipality_code}`);

      // Buscar tipos de documentos financeiros disponíveis para o município do usuário
      const financialTypes = await Document.getAvailableFinancialTypes(municipality_code, null);

      res.json({
        success: true,
        data: financialTypes
      });

    } catch (error) {
      console.error('❌ Erro ao buscar documentos financeiros do usuário logado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Obter informações de armazenamento do Google Drive
   * @route GET /api/documents/drive/storage-info
   */
  static async getDriveStorageInfo(req, res) {
    try {
      // Verificar se o serviço de OAuth do Google Drive está inicializado
      if (!googleDriveOAuthService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: 'Google Drive OAuth não está configurado',
        });
      }

      // Obter informações de armazenamento do Google Drive
      const storageInfo = await googleDriveOAuthService.getStorageInfo();

      return res.status(200).json({
        success: true,
        data: storageInfo,
      });
    } catch (error) {
      console.error('Erro ao obter informações de armazenamento do Google Drive:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter informações de armazenamento do Google Drive',
      });
    }
  }
}

module.exports = DocumentController;