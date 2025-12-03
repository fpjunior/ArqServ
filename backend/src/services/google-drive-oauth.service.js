const { google } = require('googleapis');
const fs = require('fs');

class GoogleDriveOAuthService {
  constructor() {
    this.drive = null;
    this.oauth2Client = null;
    this.rootFolderId = null;
    this.initialized = false;
    this.folderCache = new Map();
  }

  async initialize() {
    try {
      console.log('🔄 Inicializando Google Drive OAuth service...');
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      
      if (!clientId || !clientSecret || !refreshToken) {
        console.log('⚠️ Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
        return false;
      }

      // Configuração OAuth 2.0
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3005/auth/google/callback'
      );

      // Configurar tokens
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      // Inicializar Drive API
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      this.rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

      if (!this.rootFolderId) {
        throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID not configured');
      }

      // Testar conexão
      await this.testConnection();
      
      console.log('✅ Google Drive OAuth service initialized successfully');
      this.initialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Google Drive OAuth:', error.message);
      this.initialized = false;
      return false;
    }
  }

  async testConnection() {
    try {
      const response = await this.drive.about.get({ fields: 'user' });
      console.log(`✅ Connected to Google Drive as: ${response.data.user.emailAddress}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Google Drive: ${error.message}`);
    }
  }

  async createFolderIfNotExists(name, parentFolderId) {
    try {
      const cacheKey = `${parentFolderId}/${name}`;
      
      if (this.folderCache.has(cacheKey)) {
        return this.folderCache.get(cacheKey);
      }

      // Buscar pasta existente
      const searchResponse = await this.drive.files.list({
        q: `name='${name}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      if (searchResponse.data.files.length > 0) {
        const folderId = searchResponse.data.files[0].id;
        this.folderCache.set(cacheKey, folderId);
        return folderId;
      }

      // Criar nova pasta
      const createResponse = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id',
      });

      const folderId = createResponse.data.id;
      this.folderCache.set(cacheKey, folderId);
      console.log(`📁 Created folder: ${name} (${folderId})`);
      
      return folderId;

    } catch (error) {
      console.error(`❌ Error creating folder ${name}:`, error.message);
      throw error;
    }
  }

  async getServerFolderId(municipalityName, serverName) {
    try {
      console.log(`📁 Criando estrutura hierárquica para: ${municipalityName} > ${serverName}`);
      
      // 1. Pasta do município
      const municipalityFolderId = await this.createFolderIfNotExists(
        municipalityName, 
        this.rootFolderId
      );
      console.log(`📁 Pasta município criada: ${municipalityName} (ID: ${municipalityFolderId})`);

      // 2. Pasta da letra do servidor
      const firstLetter = serverName.charAt(0).toUpperCase();
      const letterFolderName = `Servidores ${firstLetter}`;
      console.log(`📁 Criando pasta da letra: ${letterFolderName} (primeira letra de "${serverName}" é "${firstLetter}")`);
      
      const letterFolderId = await this.createFolderIfNotExists(
        letterFolderName,
        municipalityFolderId
      );
      console.log(`📁 Pasta letra criada: ${letterFolderName} (ID: ${letterFolderId})`);

      // 3. Pasta do servidor específico
      console.log(`📁 Criando pasta do servidor: ${serverName}`);
      const serverFolderId = await this.createFolderIfNotExists(
        serverName,
        letterFolderId
      );
      console.log(`📁 Pasta servidor criada: ${serverName} (ID: ${serverFolderId})`);

      console.log(`✅ Estrutura completa: ${municipalityName} > ${letterFolderName} > ${serverName}`);
      return serverFolderId;

    } catch (error) {
      console.error('❌ Error getting server folder ID:', error.message);
      throw error;
    }
  }

  async uploadFile(fileBufferOrPath, fileName, municipalityName, serverName, mimeType = 'application/octet-stream') {
    try {
      if (!this.initialized) {
        throw new Error('Google Drive OAuth service not initialized');
      }

      console.log(`📤 Starting Google Drive OAuth upload: ${fileName}`);
      console.log(`📍 Município: ${municipalityName}, Servidor: ${serverName}`);

      // Obter ID da pasta do servidor
      const parentFolderId = await this.getServerFolderId(municipalityName, serverName);

      // Preparar metadata do arquivo
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId],
      };

      // Preparar stream do arquivo - aceita tanto buffer quanto caminho
      let media;
      if (Buffer.isBuffer(fileBufferOrPath)) {
        const { Readable } = require('stream');
        const bufferStream = new Readable();
        bufferStream.push(fileBufferOrPath);
        bufferStream.push(null);
        
        media = {
          mimeType: mimeType,
          body: bufferStream,
        };
      } else {
        media = {
          mimeType: mimeType,
          body: fs.createReadStream(fileBufferOrPath),
        };
      }

      console.log(`☁️ Uploading to Google Drive folder: ${parentFolderId}`);
      
      // Fazer upload
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, mimeType, createdTime, webViewLink, webContentLink',
      });

      const fileData = response.data;
      
      console.log(`✅ File uploaded successfully: ${fileData.name} (${fileData.id})`);
      
      return {
        googleDriveId: fileData.id,
        googleDriveLink: fileData.webViewLink,
        downloadLink: fileData.webContentLink,
        size: fileData.size,
        mimeType: fileData.mimeType,
        createdTime: fileData.createdTime
      };

    } catch (error) {
      console.error('❌ Error uploading file to Google Drive:', error.message);
      throw error;
    }
  }

  async uploadFinancialDocument(fileBuffer, fileName, municipalityName, documentType, year, period = null, mimeType = 'application/octet-stream') {
    try {
      if (!this.initialized) {
        throw new Error('Google Drive OAuth service not initialized');
      }

      console.log(`📤 Starting financial document upload: ${fileName}`);
      console.log(`📍 Município: ${municipalityName}, Tipo: ${documentType}, Ano: ${year}, Período: ${period || 'Anual'}`);

      // Obter ID da pasta para documentos financeiros
      const parentFolderId = await this.getFinancialDocumentFolderId(municipalityName, documentType, year, period);

      // Preparar metadata do arquivo
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId],
      };

      // Preparar stream do arquivo
      const { Readable } = require('stream');
      const bufferStream = new Readable();
      bufferStream.push(fileBuffer);
      bufferStream.push(null);
      
      const media = {
        mimeType: mimeType,
        body: bufferStream,
      };

      console.log(`☁️ Uploading financial document to Google Drive folder: ${parentFolderId}`);
      
      // Fazer upload
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, mimeType, createdTime, webViewLink, webContentLink',
      });

      const fileData = response.data;
      
      console.log(`✅ Financial document uploaded successfully: ${fileData.name} (${fileData.id})`);
      
      return {
        googleDriveId: fileData.id,
        googleDriveLink: fileData.webViewLink,
        downloadLink: fileData.webContentLink,
        size: fileData.size,
        mimeType: fileData.mimeType,
        createdTime: fileData.createdTime
      };

    } catch (error) {
      console.error('❌ Error uploading financial document to Google Drive:', error.message);
      throw error;
    }
  }

  async getFinancialDocumentFolderId(municipalityName, documentType, year, period = null) {
    try {
      console.log(`🗂️ Getting financial document folder ID for ${municipalityName}/${documentType}/${year}/${period || 'Anual'}`);
      
      // 1. Obter ou criar pasta do município
      const municipalityFolderId = await this.createFolderIfNotExists(municipalityName, this.rootFolderId);
      console.log(`📍 Municipality folder: ${municipalityFolderId}`);
      
      // 2. Obter ou criar pasta "Documentações Financeiras"
      const financialFolderId = await this.createFolderIfNotExists('Documentações Financeiras', municipalityFolderId);
      console.log(`💰 Financial folder: ${financialFolderId}`);
      
      // 3. Obter ou criar pasta do tipo de documento
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
      
      const typeFolderName = typeNames[documentType] || documentType;
      const typeFolderId = await this.createFolderIfNotExists(typeFolderName, financialFolderId);
      console.log(`📂 Document type folder: ${typeFolderId}`);
      
      return typeFolderId;

    } catch (error) {
      console.error('❌ Error getting financial document folder ID:', error.message);
      throw error;
    }
  }

  async deleteFile(fileId) {
    try {
      if (!this.initialized) {
        return false;
      }

      await this.drive.files.delete({ fileId });
      console.log(`🗑️ File deleted from Google Drive: ${fileId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error deleting file from Google Drive:`, error.message);
      return false;
    }
  }

  generateAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Download de arquivo do Google Drive
   */
  async downloadFile(fileId) {
    try {
      if (!this.initialized) {
        throw new Error('Google Drive OAuth service not initialized');
      }

      console.log(`⬇️ Baixando arquivo do Google Drive: ${fileId}`);

      // Primeiro, obter informações do arquivo
      const fileInfo = await this.drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size'
      });

      // Fazer download do arquivo
      const fileData = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'stream'
      });

      return {
        success: true,
        stream: fileData.data,
        fileName: fileInfo.data.name,
        mimeType: fileInfo.data.mimeType,
        size: fileInfo.data.size
      };

    } catch (error) {
      console.error('❌ Erro no download do arquivo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Listar arquivos em uma pasta específica do Google Drive
   */
  async listFilesInFolder(folderId) {
    try {
      if (!this.initialized) {
        throw new Error('Google Drive OAuth service not initialized');
      }

      console.log(`📁 Listando arquivos na pasta: ${folderId}`);
      
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
        orderBy: 'name'
      });

      const files = response.data.files || [];
      console.log(`📄 Encontrados ${files.length} arquivos na pasta`);
      
      return {
        success: true,
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ? parseInt(file.size) : null,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink
        }))
      };
      
    } catch (error) {
      console.error('❌ Erro ao listar arquivos na pasta:', error);
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  isInitialized() {
    return this.initialized;
  }

  getStorageInfo() {
    return {
      isInitialized: this.initialized,
      storageType: this.initialized ? 'Google Drive (OAuth)' : 'Local Storage',
      rootFolder: this.rootFolderId || 'N/A'
    };
  }
}

// Singleton instance
const googleDriveOAuthService = new GoogleDriveOAuthService();

module.exports = googleDriveOAuthService;