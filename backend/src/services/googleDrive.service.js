const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initializeDrive();
  }

  async initializeDrive() {
    try {
      // Carregar credenciais diretamente
      const credentialsPath = path.join(__dirname, '..', 'google-drive-credentials.json');
      console.log('📁 Buscando credenciais em:', credentialsPath);
      
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Arquivo de credenciais não encontrado: ${credentialsPath}`);
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Configurar autenticação
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      // Inicializar cliente do Drive
      this.drive = google.drive({ version: 'v3', auth });
      
      console.log('✅ Google Drive API inicializada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Google Drive API:', error);
      throw error;
    }
  }

  /**
   * Criar pasta no Google Drive
   */
  async createFolder(name, parentFolderId = null) {
    try {
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID]
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name,parents'
      });

      console.log(`📁 Pasta criada: ${name} (ID: ${folder.data.id})`);
      return folder.data;
    } catch (error) {
      console.error('❌ Erro ao criar pasta:', error);
      throw error;
    }
  }

  /**
   * Upload de arquivo para o Google Drive
   */
  async uploadFile(fileBuffer, fileName, mimeType, folderId) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: mimeType,
        body: require('stream').Readable.from(fileBuffer)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,size,mimeType,createdTime'
      });

      console.log(`📄 Arquivo enviado: ${fileName} (ID: ${file.data.id})`);
      return file.data;
    } catch (error) {
      console.error('❌ Erro ao enviar arquivo:', error);
      throw error;
    }
  }

  /**
   * Listar arquivos de uma pasta
   */
  async listFiles(folderId) {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,size,mimeType,createdTime,modifiedTime)',
        orderBy: 'name'
      });

      return response.data.files;
    } catch (error) {
      console.error('❌ Erro ao listar arquivos:', error);
      throw error;
    }
  }

  /**
   * Baixar arquivo do Google Drive
   */
  async downloadFile(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      return response.data;
    } catch (error) {
      console.error('❌ Erro ao baixar arquivo:', error);
      throw error;
    }
  }

  /**
   * Deletar arquivo do Google Drive
   */
  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({
        fileId: fileId
      });

      console.log(`🗑️ Arquivo deletado: ${fileId}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar arquivo:', error);
      throw error;
    }
  }

  /**
   * Obter informações de um arquivo
   */
  async getFileInfo(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,size,mimeType,createdTime,modifiedTime,parents'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Erro ao obter informações do arquivo:', error);
      throw error;
    }
  }

  /**
   * Criar estrutura de pastas para um município
   */
  async createMunicipalityFolders(municipalityName, municipalityCode) {
    try {
      // Criar pasta principal do município
      const mainFolder = await this.createFolder(`${municipalityName} - ${municipalityCode}`);
      
      // Criar subpastas
      const subfolders = ['Contratos', 'Licitações', 'Documentos Gerais', 'Atas', 'Relatórios'];
      const createdFolders = {};
      
      for (const subfolder of subfolders) {
        const folder = await this.createFolder(subfolder, mainFolder.id);
        createdFolders[subfolder.toLowerCase().replace(' ', '_')] = folder.id;
      }

      return {
        mainFolderId: mainFolder.id,
        subfolders: createdFolders
      };
    } catch (error) {
      console.error('❌ Erro ao criar estrutura de pastas:', error);
      throw error;
    }
  }
}

module.exports = new GoogleDriveService();