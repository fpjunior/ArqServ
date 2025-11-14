const Municipality = require('../models/municipality.model');
const GoogleDriveService = require('../services/googleDrive.service');

// Instanciar serviço do Google Drive
const googleDriveService = new GoogleDriveService();

class MunicipalityController {
  /**
   * Criar novo município
   * @route POST /api/municipalities
   */
  static async createMunicipality(req, res) {
    try {
      const { code, name, state } = req.body;

      if (!code || !name || !state) {
        return res.status(400).json({
          success: false,
          message: 'Código, nome e estado são obrigatórios'
        });
      }

      // Verificar se município já existe
      const existingMunicipality = await Municipality.findByCode(code);
      if (existingMunicipality) {
        return res.status(409).json({
          success: false,
          message: 'Município já existe',
          data: existingMunicipality
        });
      }

      let driveFolderId = null;

      try {
        // Criar pasta no Google Drive
        await googleDriveService.ensureInitialized();
        const mainFolder = await googleDriveService.createFolder(name, '1swo92v1_TeQVuZ4bUx9Xlv3dWwaKSCbc');
        driveFolderId = mainFolder.id;

        console.log(`📁 Pasta criada para município ${name}: ${driveFolderId}`);
      } catch (error) {
        console.warn('⚠️ Erro ao criar pasta no Drive, continuando sem Drive:', error.message);
      }

      // Criar município no banco
      const municipality = await Municipality.create({
        code,
        name,
        state,
        drive_folder_id: driveFolderId
      });

      res.status(201).json({
        success: true,
        message: 'Município criado com sucesso',
        data: municipality
      });

    } catch (error) {
      console.error('❌ Erro ao criar município:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Listar todos os municípios
   * @route GET /api/municipalities
   */
  static async getAllMunicipalities(req, res) {
    try {
      const municipalities = await Municipality.findAll();

      res.json({
        success: true,
        data: municipalities
      });

    } catch (error) {
      console.error('❌ Erro ao buscar municípios:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Buscar município por código
   * @route GET /api/municipalities/:code
   */
  static async getMunicipalityByCode(req, res) {
    try {
      const { code } = req.params;
      const municipality = await Municipality.findByCode(code);

      if (!municipality) {
        return res.status(404).json({
          success: false,
          message: 'Município não encontrado'
        });
      }

      res.json({
        success: true,
        data: municipality
      });

    } catch (error) {
      console.error('❌ Erro ao buscar município:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Buscar municípios por nome (search)
   * @route GET /api/municipalities/search
   */
  static async searchMunicipalities(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Query de busca deve ter pelo menos 2 caracteres'
        });
      }

      const municipalities = await Municipality.search(q);

      res.json({
        success: true,
        data: municipalities
      });

    } catch (error) {
      console.error('❌ Erro na busca:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Atualizar município
   * @route PUT /api/municipalities/:code
   */
  static async updateMunicipality(req, res) {
    try {
      const { code } = req.params;
      const updates = req.body;

      // Verificar se município existe
      const existingMunicipality = await Municipality.findByCode(code);
      if (!existingMunicipality) {
        return res.status(404).json({
          success: false,
          message: 'Município não encontrado'
        });
      }

      // Atualizar município
      const updatedMunicipality = await Municipality.update(code, updates);

      res.json({
        success: true,
        message: 'Município atualizado com sucesso',
        data: updatedMunicipality
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar município:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Deletar município
   * @route DELETE /api/municipalities/:code
   */
  static async deleteMunicipality(req, res) {
    try {
      const { code } = req.params;

      // Verificar se município existe
      const existingMunicipality = await Municipality.findByCode(code);
      if (!existingMunicipality) {
        return res.status(404).json({
          success: false,
          message: 'Município não encontrado'
        });
      }

      // Soft delete
      await Municipality.delete(code);

      res.json({
        success: true,
        message: 'Município deletado com sucesso'
      });

    } catch (error) {
      console.error('❌ Erro ao deletar município:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = MunicipalityController;