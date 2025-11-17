const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.rootFolderId = null;
    this.initialized = false;
    this.folderCache = new Map(); // Cache para IDs das pastas
  }

  async initialize() {
    try {
      // Verificar se as credenciais existem
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || '/app/google-drive-credentials.json';
      
      if (!fs.existsSync(credentialsPath)) {
        console.log('⚠️  Google Drive credentials not found. Upload will work in LOCAL mode only.');
        this.initialized = false;
        return false;
      }

      // Carregar credenciais
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      
      // Configurar autenticação
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      // Inicializar Drive API
      this.drive = google.drive({ version: 'v3', auth });
      this.rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

      if (!this.rootFolderId) {
        throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID not configured');
      }

      console.log('✅ Google Drive service initialized successfully');
      this.initialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error.message);
      this.initialized = false;
      return false;
    }
  }

  async createFolderIfNotExists(name, parentFolderId) {
    try {
      const cacheKey = `${parentFolderId}/${name}`;
      
      // Verificar cache primeiro
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
      // Criar hierarquia: Root > Municipality > Server Letter > Server Name
      
      // 1. Pasta do município
      const municipalityFolderId = await this.createFolderIfNotExists(
        municipalityName, 
        this.rootFolderId
      );

      // 2. Pasta da letra do servidor (ex: "Servidores A")
      const firstLetter = serverName.charAt(0).toUpperCase();
      const letterFolderName = `Servidores ${firstLetter}`;
      const letterFolderId = await this.createFolderIfNotExists(
        letterFolderName,
        municipalityFolderId
      );

      // 3. Pasta do servidor específico
      const serverFolderId = await this.createFolderIfNotExists(
        serverName,
        letterFolderId
      );

      return serverFolderId;

    } catch (error) {
      console.error('❌ Error getting server folder ID:', error.message);
      throw error;
    }
  }

  async uploadFile(filePath, fileName, municipalityName, serverName) {
    try {
      if (!this.initialized) {
        throw new Error('Google Drive service not initialized');
      }

      // Obter ID da pasta do servidor
      const parentFolderId = await this.getServerFolderId(municipalityName, serverName);

      // Upload do arquivo
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId],
      };

      const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(filePath),
      };

      console.log(`📤 Uploading file to Google Drive: ${fileName}`);
      
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, mimeType, createdTime, webViewLink',
      });

      const fileData = response.data;
      
      console.log(`✅ File uploaded successfully: ${fileData.name} (${fileData.id})`);
      
      return {
        googleDriveId: fileData.id,
        googleDriveLink: fileData.webViewLink,
        size: fileData.size,
        mimeType: fileData.mimeType,
        createdTime: fileData.createdTime
      };

    } catch (error) {
      console.error('❌ Error uploading file to Google Drive:', error.message);
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

  isInitialized() {
    return this.initialized;
  }
}

// Singleton instance
const googleDriveService = new GoogleDriveService();

module.exports = googleDriveService;