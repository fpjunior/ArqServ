const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const googleDriveService = require('./src/services/google-drive-oauth.service');

async function fixPermissions() {
    console.log('🚀 Iniciando correção de permissões do Google Drive...');

    try {
        // 1. Inicializar serviço
        console.log('🔄 Inicializando serviço...');
        await googleDriveService.initialize();

        // 2. Listar TODOS os arquivos que este app criou (devido ao escopo drive.file)
        // Buscamos apenas arquivos (não pastas) que não estão na lixeira
        console.log('📋 Listando arquivos...');
        let allFiles = [];
        let pageToken = null;

        do {
            const response = await googleDriveService.drive.files.list({
                // Filtrar apenas arquivos (excluir pastas) e ignorar lixo
                q: "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'nextPageToken, files(id, name, webViewLink, permissions)',
                pageToken: pageToken,
                pageSize: 100
            });

            const files = response.data.files;
            allFiles = allFiles.concat(files);
            pageToken = response.data.nextPageToken;
            console.log(`   ... encontrados ${files.length} arquivos nesta página`);
        } while (pageToken);

        console.log(`📊 Total de arquivos encontrados: ${allFiles.length}`);

        // 3. Atualizar permissões
        console.log('🔓 Atualizando permissões para "Público (Leitura)"...');

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const file of allFiles) {
            // Verificar se já é público
            const isPublic = file.permissions && file.permissions.some(p => p.type === 'anyone');

            if (isPublic) {
                console.log(`⏩ [PULA] ${file.name} já é público.`);
                skippedCount++;
                continue;
            }

            console.log(`🔄 [FIX] Atualizando: ${file.name} (${file.id})...`);

            try {
                await googleDriveService.drive.permissions.create({
                    fileId: file.id,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone',
                    },
                });
                console.log(`   ✅ Sucesso!`);
                successCount++;
            } catch (err) {
                console.error(`   ❌ Erro: ${err.message}`);
                errorCount++;
            }

            // Delay pequeno para evitar rate limit do Google
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log('\n🏁 Resumo da Operação:');
        console.log(`Total processado: ${allFiles.length}`);
        console.log(`✅ Atualizados: ${successCount}`);
        console.log(`⏩ Pulados (já públicos): ${skippedCount}`);
        console.log(`❌ Erros: ${errorCount}`);

    } catch (error) {
        console.error('❌ Erro fatal:', error);
    }
}

fixPermissions();
