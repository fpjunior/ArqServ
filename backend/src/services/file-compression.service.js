const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

/**
 * Serviço de compressão de arquivos antes do upload ao Google Drive.
 * 
 * - PDFs: comprimidos via Ghostscript (gs) com qualidade /ebook (~150dpi)
 * - Imagens: comprimidas com sharp (se disponível) ou mantidas como estão
 * 
 * Objetivo: manter todos os arquivos abaixo de 100 MB para que o
 * Google Drive consiga exibir preview diretamente.
 */
class FileCompressionService {
  constructor() {
    this.TARGET_SIZE = 100 * 1024 * 1024; // 100 MB – limite do Google Drive para preview
    this.gsAvailable = null; // lazy check
  }

  /**
   * Verifica se o Ghostscript está instalado no sistema.
   */
  async isGhostscriptAvailable() {
    if (this.gsAvailable !== null) return this.gsAvailable;

    return new Promise((resolve) => {
      execFile('gs', ['--version'], (error) => {
        this.gsAvailable = !error;
        if (this.gsAvailable) {
          console.log('✅ Ghostscript disponível para compressão de PDFs');
        } else {
          console.log('⚠️ Ghostscript NÃO disponível – PDFs não serão comprimidos');
        }
        resolve(this.gsAvailable);
      });
    });
  }

  /**
   * Decide se um arquivo precisa ser comprimido.
   */
  needsCompression(filePath, mimeType) {
    try {
      const stats = fs.statSync(filePath);
      // Comprimir se estiver acima do target ou acima de 25 MB (para melhor UX)
      return stats.size > 25 * 1024 * 1024;
    } catch {
      return false;
    }
  }

  /**
   * Comprime um arquivo (PDF ou imagem) e retorna o caminho do arquivo comprimido.
   * Se a compressão não for possível ou não melhorar, retorna o arquivo original.
   * 
   * @param {string} filePath - Caminho do arquivo original
   * @param {string} mimeType - MIME type do arquivo
   * @returns {Promise<{path: string, compressed: boolean, originalSize: number, finalSize: number}>}
   */
  async compressFile(filePath, mimeType) {
    const originalStats = fs.statSync(filePath);
    const originalSize = originalStats.size;
    const result = {
      path: filePath,
      compressed: false,
      originalSize,
      finalSize: originalSize
    };

    console.log(`🗜️ [COMPRESSÃO] Analisando: ${path.basename(filePath)} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`);

    // Verificar se precisa comprimir
    if (!this.needsCompression(filePath, mimeType)) {
      console.log(`✅ [COMPRESSÃO] Arquivo pequeno, não precisa comprimir`);
      return result;
    }

    const mimeTypeLower = (mimeType || '').toLowerCase();

    if (mimeTypeLower.includes('pdf')) {
      return this.compressPdf(filePath, originalSize);
    }

    if (mimeTypeLower.includes('image')) {
      return this.compressImage(filePath, mimeType, originalSize);
    }

    // Outros tipos de arquivo não são comprimidos
    console.log(`ℹ️ [COMPRESSÃO] Tipo ${mimeType} não suporta compressão`);
    return result;
  }

  /**
   * Comprime PDF usando Ghostscript.
   * Tenta níveis de compressão progressivos até ficar abaixo de 100MB.
   */
  async compressPdf(filePath, originalSize) {
    const result = {
      path: filePath,
      compressed: false,
      originalSize,
      finalSize: originalSize
    };

    const gsAvailable = await this.isGhostscriptAvailable();
    if (!gsAvailable) {
      console.log('⚠️ [COMPRESSÃO] Ghostscript não disponível, enviando PDF sem compressão');
      return result;
    }

    // Níveis de qualidade do Ghostscript (do melhor para o mais comprimido):
    // /prepress  – ~300dpi, alta qualidade (para impressão)
    // /ebook     – ~150dpi, boa qualidade (ideal para visualização)
    // /screen    – ~72dpi, qualidade baixa (apenas tela)
    const qualityLevels = [
      { name: 'ebook', dpi: 150, setting: '/ebook' },
      { name: 'screen', dpi: 72, setting: '/screen' },
    ];

    for (const level of qualityLevels) {
      console.log(`🗜️ [COMPRESSÃO] Tentando nível "${level.name}" (${level.dpi}dpi)...`);

      try {
        const outputPath = filePath.replace(/\.pdf$/i, `_compressed_${level.name}.pdf`);
        await this.runGhostscript(filePath, outputPath, level.setting);

        if (fs.existsSync(outputPath)) {
          const compressedStats = fs.statSync(outputPath);
          const compressionRatio = ((1 - compressedStats.size / originalSize) * 100).toFixed(1);

          console.log(`📊 [COMPRESSÃO] Resultado "${level.name}": ${(compressedStats.size / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% menor)`);

          // Usar arquivo comprimido se for menor e válido (> 1KB = não vazio)
          if (compressedStats.size < originalSize && compressedStats.size > 1024) {
            result.path = outputPath;
            result.compressed = true;
            result.finalSize = compressedStats.size;

            // Se já está abaixo de 100MB, parar
            if (compressedStats.size <= this.TARGET_SIZE) {
              console.log(`✅ [COMPRESSÃO] Sucesso! ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedStats.size / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% redução)`);
              return result;
            }

            console.log(`⚠️ [COMPRESSÃO] Ainda acima de 100MB, tentando nível mais agressivo...`);
            // Continuar para o próximo nível
          } else {
            // Compressão não melhorou, remover arquivo
            try { fs.unlinkSync(outputPath); } catch (e) { /* ignora */ }
          }
        }
      } catch (error) {
        console.error(`❌ [COMPRESSÃO] Erro no nível "${level.name}":`, error.message);
      }
    }

    // Se comprimiu mas ainda está acima de 100MB, usar a melhor compressão que temos
    if (result.compressed) {
      const compressionRatio = ((1 - result.finalSize / originalSize) * 100).toFixed(1);
      console.log(`⚠️ [COMPRESSÃO] Arquivo ainda grande mas foi reduzido: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(result.finalSize / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% redução)`);
    } else {
      console.log(`⚠️ [COMPRESSÃO] Não foi possível comprimir o PDF`);
    }

    return result;
  }

  /**
   * Executa Ghostscript para comprimir um PDF.
   */
  runGhostscript(inputPath, outputPath, qualitySetting) {
    return new Promise((resolve, reject) => {
      const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${qualitySetting}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dMonoImageDownsampleType=/Subsample',
        '-dOptimize=true',
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        `-sOutputFile=${outputPath}`,
        inputPath
      ];

      // Timeout de 5 minutos para arquivos muito grandes
      const timeout = 5 * 60 * 1000;

      const child = execFile('gs', args, { timeout }, (error, stdout, stderr) => {
        if (error) {
          // Se o arquivo de saída foi criado parcialmente, remover
          try { fs.unlinkSync(outputPath); } catch (e) { /* ignora */ }
          reject(new Error(`Ghostscript falhou: ${error.message}`));
        } else {
          resolve(outputPath);
        }
      });
    });
  }

  /**
   * Comprime imagens redimensionando e reduzindo qualidade.
   * Usa sharp se disponível no sistema.
   */
  async compressImage(filePath, mimeType, originalSize) {
    const result = {
      path: filePath,
      compressed: false,
      originalSize,
      finalSize: originalSize
    };

    try {
      const sharp = require('sharp');
      const outputPath = filePath.replace(/\.[^.]+$/, '_compressed.jpg');

      // Obter metadata da imagem
      const metadata = await sharp(filePath).metadata();
      console.log(`🖼️ [COMPRESSÃO] Imagem: ${metadata.width}x${metadata.height}, ${metadata.format}`);

      // Redimensionar se muito grande (manter proporcional)
      let pipeline = sharp(filePath);
      const maxDimension = 4096;

      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        pipeline = pipeline.resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Comprimir
      if (mimeType.includes('png')) {
        await pipeline.png({ quality: 80, compressionLevel: 9 }).toFile(outputPath);
      } else {
        await pipeline.jpeg({ quality: 80, progressive: true }).toFile(outputPath);
      }

      const compressedStats = fs.statSync(outputPath);
      if (compressedStats.size < originalSize) {
        result.path = outputPath;
        result.compressed = true;
        result.finalSize = compressedStats.size;
        const ratio = ((1 - compressedStats.size / originalSize) * 100).toFixed(1);
        console.log(`✅ [COMPRESSÃO] Imagem comprimida: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedStats.size / 1024 / 1024).toFixed(2)} MB (${ratio}% redução)`);
      } else {
        try { fs.unlinkSync(outputPath); } catch (e) { /* ignora */ }
        console.log(`ℹ️ [COMPRESSÃO] Imagem já estava otimizada`);
      }
    } catch (error) {
      // sharp não está instalado ou erro na compressão
      console.log(`ℹ️ [COMPRESSÃO] Compressão de imagem não disponível: ${error.message}`);
    }

    return result;
  }

  /**
   * Remove arquivos temporários de compressão.
   */
  cleanup(compressResult, originalPath) {
    if (!compressResult) return;

    // Se usamos um arquivo comprimido, remover o comprimido (o original é removido pelo controller)
    if (compressResult.compressed && compressResult.path !== originalPath) {
      try {
        fs.unlinkSync(compressResult.path);
        console.log(`🧹 [COMPRESSÃO] Arquivo comprimido temporário removido`);
      } catch (e) {
        // Ignora erro na limpeza
      }
    }
  }
}

// Singleton
const fileCompressionService = new FileCompressionService();
module.exports = fileCompressionService;
