const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Importar validações
const { 
  validateBounds, 
  validateDPI, 
  validateImageDimensions,
  sanitizeString 
} = require('./validators');

// ===== CONFIGURAÇÕES DE SEGURANÇA =====
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_PIXELS = 50000000; // 50 megapixels
const GDAL_TIMEOUT = 60000; // 60 segundos
const ALLOWED_TEMP_DIR = path.resolve(__dirname, '..', 'temp');
const GDAL_BINARY = process.env.GDAL_BINARY || 'gdal_translate';

// Middleware para processar JSON com validação de tamanho
router.use(express.json({ 
  limit: '100mb',
  verify: (req, res, buf) => {
    if (buf.length > MAX_FILE_SIZE) {
      const error = new Error('Payload muito grande');
      error.status = 413;
      throw error;
    }
  }
}));

// ===== FUNÇÕES DE VALIDAÇÃO E SANITIZAÇÃO =====

/**
 * Valida e sanitiza dados base64 de imagem
 */
function validateBase64Image(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('imageData deve ser uma string válida');
  }

  // Verificar formato base64 válido
  const base64Regex = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/;
  const match = imageData.match(base64Regex);
  
  if (!match) {
    throw new Error('imageData deve estar no formato data:image/(png|jpeg);base64,...');
  }

  const [, format, base64Data] = match;
  
  // Verificar se base64 é válido
  if (!base64Data || base64Data.length === 0) {
    throw new Error('Dados base64 da imagem estão vazios');
  }

  // Verificar tamanho do base64 (aprox 4/3 do tamanho real)
  const estimatedSize = (base64Data.length * 3) / 4;
  if (estimatedSize > MAX_FILE_SIZE) {
    throw new Error(`Imagem muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  try {
    // Tentar decodificar para validar
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Verificar se não está vazio após decodificação
    if (buffer.length === 0) {
      throw new Error('Imagem decodificada está vazia');
    }

    return {
      format: format,
      base64Data: base64Data,
      buffer: buffer,
      size: buffer.length
    };
  } catch (error) {
    throw new Error(`Erro decodificando base64: ${error.message}`);
  }
}

/**
 * Sanitiza argumentos para GDAL
 */
function sanitizeGDALArgs(args) {
  return args.map(arg => {
    // Converter para string
    const str = String(arg);
    
    // Remover caracteres perigosos
    const sanitized = str.replace(/[;&|`$(){}[\]<>'"\\]/g, '');
    
    // Verificar se não ficou vazio
    if (sanitized.length === 0 && str.length > 0) {
      throw new Error(`Argumento contém apenas caracteres não permitidos: ${str}`);
    }
    
    return sanitized;
  });
}

/**
 * Executa comando GDAL com segurança usando spawn
 */
function executeGDALCommand(args, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = GDAL_TIMEOUT, cwd } = options;
    
    // Sanitizar argumentos
    const sanitizedArgs = sanitizeGDALArgs(args);
    
    console.log(`Executando GDAL: ${GDAL_BINARY} ${sanitizedArgs.join(' ')}`);
    
    const process = spawn(GDAL_BINARY, sanitizedArgs, {
      cwd: cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeout,
      killSignal: 'SIGKILL'
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      process.kill('SIGKILL');
      reject(new Error(`GDAL timeout após ${timeout}ms`));
    }, timeout);

    process.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        console.error(`GDAL stderr: ${stderr}`);
        reject(new Error(`GDAL falhou com código ${code}: ${stderr || 'Erro desconhecido'}`));
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Erro executando GDAL: ${error.message}`));
    });
  });
}

/**
 * Cria arquivo VRT seguro
 */
function createSecureVRT(bounds, width, height, imagePath) {
  const { west, east, north, south } = bounds;
  
  // Validar que imagePath é seguro (apenas nome do arquivo)
  const safePath = path.basename(imagePath);
  if (safePath !== imagePath) {
    throw new Error('Path da imagem deve ser apenas o nome do arquivo');
  }
  
  // Calcular transformação geográfica
  const pixelWidth = (east - west) / width;
  const pixelHeight = -(north - south) / height; // Negativo pois Y cresce para baixo
  
  // Template VRT com escape adequado
  return `<VRTDataset rasterXSize="${width}" rasterYSize="${height}">
  <SRS>EPSG:4326</SRS>
  <GeoTransform>${west}, ${pixelWidth}, 0, ${north}, 0, ${pixelHeight}</GeoTransform>
  <VRTRasterBand dataType="Byte" band="1">
    <ColorInterp>Red</ColorInterp>
    <SimpleSource>
      <SourceFilename relativeToVRT="1">${safePath}</SourceFilename>
      <SourceBand>1</SourceBand>
    </SimpleSource>
  </VRTRasterBand>
  <VRTRasterBand dataType="Byte" band="2">
    <ColorInterp>Green</ColorInterp>
    <SimpleSource>
      <SourceFilename relativeToVRT="1">${safePath}</SourceFilename>
      <SourceBand>2</SourceBand>
    </SimpleSource>
  </VRTRasterBand>
  <VRTRasterBand dataType="Byte" band="3">
    <ColorInterp>Blue</ColorInterp>
    <SimpleSource>
      <SourceFilename relativeToVRT="1">${safePath}</SourceFilename>
      <SourceBand>3</SourceBand>
    </SimpleSource>
  </VRTRasterBand>
  <VRTRasterBand dataType="Byte" band="4">
    <ColorInterp>Alpha</ColorInterp>
    <SimpleSource>
      <SourceFilename relativeToVRT="1">${safePath}</SourceFilename>
      <SourceBand>4</SourceBand>
    </SimpleSource>
  </VRTRasterBand>
</VRTDataset>`;
}

/**
 * Criar diretório temporário seguro
 */
async function createSecureTempDir() {
  // Gerar UUID para diretório
  const dirId = uuidv4();
  const tempDir = path.join(ALLOWED_TEMP_DIR, dirId);
  
  // Verificar se está dentro do diretório permitido
  const resolvedTempDir = path.resolve(tempDir);
  const resolvedAllowedDir = path.resolve(ALLOWED_TEMP_DIR);
  
  if (!resolvedTempDir.startsWith(resolvedAllowedDir)) {
    throw new Error('Tentativa de path traversal detectada');
  }
  
  // Criar diretório
  await fs.mkdir(tempDir, { recursive: true });
  
  return tempDir;
}

/**
 * Limpar diretório com segurança
 */
async function secureCleanup(tempDir) {
  try {
    // Verificar se está dentro do diretório permitido
    const resolvedTempDir = path.resolve(tempDir);
    const resolvedAllowedDir = path.resolve(ALLOWED_TEMP_DIR);
    
    if (!resolvedTempDir.startsWith(resolvedAllowedDir)) {
      console.error('Tentativa de limpeza fora do diretório permitido:', tempDir);
      return;
    }
    
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Erro na limpeza segura:', error);
  }
}

// ===== ENDPOINT PRINCIPAL =====
router.post('/gerar', async (req, res) => {
  const startTime = Date.now();
  let tempDir = null;
  
  try {
    // Criar diretório temporário seguro
    tempDir = await createSecureTempDir();
    
    // Extrair e validar dados da requisição
    const { imageData, bounds, width, height, dpi = 300 } = req.body;
    
    // Validação obrigatória
    if (!imageData) {
      return res.status(400).json({ 
        error: 'imageData é obrigatório',
        code: 'MISSING_IMAGE_DATA'
      });
    }
    
    if (!bounds) {
      return res.status(400).json({ 
        error: 'bounds é obrigatório',
        code: 'MISSING_BOUNDS'
      });
    }
    
    if (!width || !height) {
      return res.status(400).json({ 
        error: 'width e height são obrigatórios',
        code: 'MISSING_DIMENSIONS'
      });
    }
    
    // Validar base64 da imagem
    const imageValidation = validateBase64Image(imageData);
    
    // Validar bounds geográficos
    const boundsValidation = validateBounds(bounds);
    if (!boundsValidation.valid) {
      return res.status(400).json({ 
        error: boundsValidation.error,
        code: 'INVALID_BOUNDS'
      });
    }
    
    // Validar dimensões da imagem
    const dimensionsValidation = validateImageDimensions(width, height);
    if (!dimensionsValidation.valid) {
      return res.status(400).json({ 
        error: dimensionsValidation.error,
        code: 'INVALID_DIMENSIONS'
      });
    }
    
    // Verificar se imagem não é muito grande em pixels
    if (dimensionsValidation.width * dimensionsValidation.height > MAX_IMAGE_PIXELS) {
      return res.status(400).json({ 
        error: `Imagem muito grande. Máximo: ${MAX_IMAGE_PIXELS / 1000000}MP`,
        code: 'IMAGE_TOO_LARGE'
      });
    }
    
    // Validar DPI
    const dpiValidation = validateDPI(dpi);
    if (!dpiValidation.valid) {
      return res.status(400).json({ 
        error: dpiValidation.error,
        code: 'INVALID_DPI'
      });
    }
    
    // Salvar imagem temporariamente com nome seguro
    const inputFilename = 'input.png';
    const inputPath = path.join(tempDir, inputFilename);
    const outputPath = path.join(tempDir, 'output.pdf');
    const vrtPath = path.join(tempDir, 'input.vrt');
    
    await fs.writeFile(inputPath, imageValidation.buffer);
    
    // Criar arquivo VRT
    const vrtContent = createSecureVRT(
      boundsValidation.normalized, 
      dimensionsValidation.width, 
      dimensionsValidation.height, 
      inputFilename
    );
    await fs.writeFile(vrtPath, vrtContent);
    
    // Construir argumentos GDAL de forma segura
    const gdalArgs = [
      '-of', 'PDF',
      '-co', `DPI=${dpiValidation.dpi}`,
      '-co', 'WRITE_GEO=YES',
      '-co', 'WRITE_USERUNIT=YES',
      '-co', 'MARGIN_LEFT=0',
      '-co', 'MARGIN_RIGHT=0',
      '-co', 'MARGIN_TOP=0',
      '-co', 'MARGIN_BOTTOM=0',
      '-co', 'GEO_ENCODING=ISO32000',
      vrtPath,
      outputPath
    ];
    
    // Executar GDAL com segurança
    console.log(`Iniciando processamento GDAL - Bounds: ${JSON.stringify(boundsValidation.normalized)}, Dimensions: ${dimensionsValidation.width}x${dimensionsValidation.height}, DPI: ${dpiValidation.dpi}`);
    
    await executeGDALCommand(gdalArgs, { 
      timeout: GDAL_TIMEOUT,
      cwd: tempDir 
    });
    
    // Verificar se o PDF foi criado
    let pdfStats;
    try {
      pdfStats = await fs.stat(outputPath);
      if (!pdfStats.isFile() || pdfStats.size === 0) {
        throw new Error('PDF gerado está vazio');
      }
    } catch (error) {
      throw new Error('PDF não foi gerado corretamente');
    }
    
    // Ler o PDF gerado
    const pdfBuffer = await fs.readFile(outputPath);
    
    // Log de sucesso com dados sanitizados
    const processingTime = Date.now() - startTime;
    console.log(`PDF georreferenciado criado com sucesso em ${processingTime}ms`, {
      bounds: boundsValidation.normalized,
      dimensions: `${dimensionsValidation.width}x${dimensionsValidation.height}`,
      dpi: dpiValidation.dpi,
      inputSize: imageValidation.size,
      outputSize: pdfBuffer.length,
      megapixels: dimensionsValidation.megapixels,
      processingTime: processingTime
    });
    
    // Gerar nome de arquivo seguro
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mapa_georref_${timestamp}.pdf`;
    
    // Enviar PDF ao cliente
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Processing-Time': `${processingTime}ms`,
      'X-Output-Size': pdfBuffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    
    res.send(pdfBuffer);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('Erro ao criar PDF georreferenciado:', {
      error: error.message,
      stack: error.stack,
      processingTime: processingTime,
      tempDir: tempDir
    });
    
    // Determinar tipo de erro e resposta apropriada
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    
    if (error.message.includes('GDAL não está instalado') || error.message.includes('ENOENT')) {
      statusCode = 503;
      errorCode = 'GDAL_NOT_AVAILABLE';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorCode = 'PROCESSING_TIMEOUT';
    } else if (error.message.includes('muito grande') || error.message.includes('inválido')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    }
    
    res.status(statusCode).json({ 
      error: 'Erro ao processar PDF',
      message: error.message,
      code: errorCode,
      processingTime: processingTime
    });
    
  } finally {
    // Limpar diretório temporário sempre
    if (tempDir) {
      await secureCleanup(tempDir);
    }
  }
});

// ===== ENDPOINT DE VERIFICAÇÃO =====
router.get('/verificar-gdal', async (req, res) => {
  try {
    const result = await executeGDALCommand(['--version'], { timeout: 5000 });
    
    res.json({ 
      disponivel: true, 
      versao: result.stdout.trim(),
      mensagem: 'GDAL está instalado e funcionando',
      binary: GDAL_BINARY
    });
  } catch (error) {
    console.error('GDAL não disponível:', error.message);
    
    res.status(503).json({ 
      disponivel: false,
      mensagem: 'GDAL não está disponível',
      erro: error.message,
      binary: GDAL_BINARY,
      sugestao: 'Verifique se o GDAL está instalado e no PATH'
    });
  }
});

// ===== ENDPOINT DE STATUS =====
router.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    config: {
      maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
      maxImagePixels: `${MAX_IMAGE_PIXELS / 1000000}MP`,
      gdalTimeout: `${GDAL_TIMEOUT / 1000}s`,
      gdalBinary: GDAL_BINARY,
      tempDir: ALLOWED_TEMP_DIR
    },
    worker: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router;