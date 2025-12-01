const Server = require('../models/server.model');
const GoogleDriveService = require('../services/googleDrive.service');

// Instanciar serviço do Google Drive
const googleDriveService = new GoogleDriveService();

class ServerController {
  /**
   * Listar todos os servidores
   * @route GET /api/servers
   */
  static async getAllServers(req, res) {
    try {
      const servers = await Server.findAll({});
      
      res.json({
        success: true,
        data: servers,
        message: 'Servidores listados com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao listar servidores:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Criar novo servidor
   * @route POST /api/servers
   */
  static async createServer(req, res) {
    try {
      const { name, municipality_code, municipality_name } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Nome do servidor é obrigatório'
        });
      }

      // Verificar se servidor já existe (apenas se municipality_code fornecido)
      if (municipality_code) {
        const existingServer = await Server.findByNameAndMunicipality(name, municipality_code);
        if (existingServer) {
          return res.status(409).json({
            success: false,
            message: 'Servidor já existe neste município',
            data: existingServer
          });
        }
      }

      let driveFolderId = null;

      try {
        // Criar estrutura de pastas no Google Drive (se municipality_code fornecido)
        if (municipality_code && municipality_name) {
          await googleDriveService.ensureInitialized();
          const folderStructure = await googleDriveService.createServerFolderStructure(
            municipality_name,
            municipality_code,
            name
          );
          driveFolderId = folderStructure.serverFolderId;

          console.log(`📁 Estrutura criada para servidor ${name}:`, folderStructure.structure);
        } else {
          console.log('⚠️ Município não fornecido, criando servidor sem pasta no Drive');
        }
      } catch (error) {
        console.warn('⚠️ Erro ao criar pastas no Drive, continuando sem Drive:', error.message);
      }

      // Criar servidor no banco
      const serverData = { name };
      if (municipality_code) serverData.municipality_code = municipality_code;
      if (driveFolderId) serverData.drive_folder_id = driveFolderId;
      
      const server = await Server.create(serverData);

      res.status(201).json({
        success: true,
        message: 'Servidor criado com sucesso',
        data: server
      });

    } catch (error) {
      console.error('❌ Erro ao criar servidor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Listar servidores por município
   * @route GET /api/servers/municipality/:code
   */
  static async getServersByMunicipality(req, res) {
    try {
      const { code } = req.params;
      const { letter } = req.query;

      console.log(`\n🔍 [GET SERVERS BY MUNICIPALITY]`);
      console.log(`📍 Código do município: ${code}`);
      console.log(`🔤 Letra filtro: ${letter || 'todas'}`);
      console.log(`👤 User ID: ${req.user?.id}`);

      let servers;
      if (letter) {
        servers = await Server.findByLetter(code, letter);
      } else {
        servers = await Server.findByMunicipality(code);
      }

      console.log(`📊 Total de servidores encontrados: ${servers.length}`);
      if (servers.length > 0) {
        console.log(`📝 Primeiros servidores:`, servers.slice(0, 3));
      }

      // Agrupar por letra se não foi especificada
      if (!letter) {
        const groupedByLetter = servers.reduce((acc, server) => {
          const firstLetter = server.name.charAt(0).toUpperCase();
          if (!acc[firstLetter]) {
            acc[firstLetter] = [];
          }
          acc[firstLetter].push(server);
          return acc;
        }, {});

        const response = {
          success: true,
          data: {
            servers,
            groupedByLetter
          }
        };
        
        console.log(`✅ Resposta com ${servers.length} servidores agrupados por ${Object.keys(groupedByLetter).length} letras`);
        
        return res.json(response);
      }

      console.log(`✅ Resposta com ${servers.length} servidores filtrados pela letra ${letter}`);

      res.json({
        success: true,
        data: servers
      });

    } catch (error) {
      console.error('❌ [ERROR] Erro ao buscar servidores:', error);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Erro ao buscar servidores:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Buscar servidor por ID
   * @route GET /api/servers/:id
   */
  static async getServerById(req, res) {
    try {
      const { id } = req.params;
      const server = await Server.findById(id);

      if (!server) {
        return res.status(404).json({
          success: false,
          message: 'Servidor não encontrado'
        });
      }

      res.json({
        success: true,
        data: server
      });

    } catch (error) {
      console.error('❌ Erro ao buscar servidor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Buscar servidores por nome (search)
   * @route GET /api/servers/search
   */
  static async searchServers(req, res) {
    try {
      const { q, municipality_code, letter } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Query de busca deve ter pelo menos 2 caracteres'
        });
      }

      const servers = await Server.findAll({
        search: q,
        municipality_code,
        letter,
        limit: 20
      });

      res.json({
        success: true,
        data: servers
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
   * Atualizar servidor
   * @route PUT /api/servers/:id
   */
  static async updateServer(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Verificar se servidor existe
      const existingServer = await Server.findById(id);
      if (!existingServer) {
        return res.status(404).json({
          success: false,
          message: 'Servidor não encontrado'
        });
      }

      // Atualizar servidor
      const updatedServer = await Server.update(id, updates);

      res.json({
        success: true,
        message: 'Servidor atualizado com sucesso',
        data: updatedServer
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar servidor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Deletar servidor
   * @route DELETE /api/servers/:id
   */
  static async deleteServer(req, res) {
    try {
      const { id } = req.params;

      // Verificar se servidor existe
      const existingServer = await Server.findById(id);
      if (!existingServer) {
        return res.status(404).json({
          success: false,
          message: 'Servidor não encontrado'
        });
      }

      // Soft delete
      await Server.delete(id);

      res.json({
        success: true,
        message: 'Servidor deletado com sucesso'
      });

    } catch (error) {
      console.error('❌ Erro ao deletar servidor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Obter estatísticas de servidores
   * @route GET /api/servers/municipality/:code/stats
   */
  static async getServerStats(req, res) {
    try {
      const { code } = req.params;
      const stats = await Server.getStatsByMunicipality(code);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = ServerController;