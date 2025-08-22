// Path: routes/pdf-export.js
const express = require('express');
const gdal = require('gdal-async');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Middleware para parsing JSON
router.use(express.json({ limit: '50mb' }));

/**
 * Validar dados de entrada
 */
function validateInput(req) {
    const { image, bounds, orientation, projection } = req.body;
    
    // Validar imagem base64
    if (!image || typeof image !== 'string') {
        return { valid: false, error: 'Imagem é obrigatória' };
    }
    
    if (!image.startsWith('data:image/')) {
        return { valid: false, error: 'Formato de imagem inválido - deve ser base64' };
    }
    
    // Validar bounds
    if (!bounds || typeof bounds !== 'object') {
        return { valid: false, error: 'Coordenadas (bounds) são obrigatórias' };
    }
    
    const requiredCoords = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    for (const coord of requiredCoords) {
        if (!bounds[coord] || !Array.isArray(bounds[coord]) || bounds[coord].length !== 2) {
            return { valid: false, error: `Coordenada ${coord} inválida - deve ser [lat, lng]` };
        }
        
        const [lat, lng] = bounds[coord];
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return { valid: false, error: `Coordenada ${coord} deve conter números válidos` };
        }
        
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return { valid: false, error: `Coordenada ${coord} fora dos limites válidos` };
        }
    }
    
    // Verificar se bounds formam um retângulo válido
    const { topLeft, topRight, bottomLeft, bottomRight } = bounds;
    
    if (topLeft[0] <= bottomLeft[0]) {
        return { valid: false, error: 'Latitude superior deve ser maior que inferior' };
    }
    
    if (topLeft[1] >= topRight[1]) {
        return { valid: false, error: 'Longitude esquerda deve ser menor que direita' };
    }
    
    // Validar orientação
    if (!orientation || !['landscape', 'portrait'].includes(orientation)) {
        return { valid: false, error: 'Orientação deve ser "landscape" ou "portrait"' };
    }
    
    // Validar projeção (opcional, padrão EPSG:4326)
    if (projection && projection !== 'EPSG:4326') {
        return { valid: false, error: 'Apenas projeção EPSG:4326 é suportada' };
    }
    
    return { valid: true };
}

/**
 * Processar imagem base64
 */
async function processImage(base64Image) {
    try {
        // Extrair dados base64
        const base64Data = base64Image.split(',')[1];
        if (!base64Data) {
            throw new Error('Dados base64 inválidos');
        }
        
        // Decodificar base64
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Processar com Sharp para garantir formato PNG otimizado
        const processedBuffer = await sharp(imageBuffer)
            .png({ quality: 90, compressionLevel: 6 })
            .toBuffer();
        
        // Obter metadados da imagem
        const metadata = await sharp(processedBuffer).metadata();
        
        return {
            imageBuffer: processedBuffer,
            width: metadata.width,
            height: metadata.height
        };
        
    } catch (error) {
        throw new Error(`Erro ao processar imagem: ${error.message}`);
    }
}

/**
 * Calcular GeoTransform para GDAL
 */
function calculateGeoTransform(bounds, imageWidth, imageHeight) {
    // GeoTransform format: [originX, pixelWidth, 0, originY, 0, -pixelHeight]
    // originX, originY = coordenadas do canto superior esquerdo
    // pixelWidth = largura de um pixel em unidades de coordenada
    // pixelHeight = altura de um pixel em unidades de coordenada (negativo)
    
    const originX = bounds.topLeft[1];  // longitude do canto superior esquerdo
    const originY = bounds.topLeft[0];  // latitude do canto superior esquerdo
    
    // Calcular resolução por pixel
    const lonRange = bounds.topRight[1] - bounds.topLeft[1];    // diferença longitude
    const latRange = bounds.topLeft[0] - bounds.bottomLeft[0];  // diferença latitude
    
    const pixelWidth = lonRange / imageWidth;
    const pixelHeight = latRange / imageHeight;
    
    return [originX, pixelWidth, 0, originY, 0, -pixelHeight];
}

/**
 * Criar PDF georreferenciado usando GDAL
 */
async function createGeoreferencedPDF(imageBuffer, bounds, orientation) {
    const tempId = uuidv4();
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Garantir que diretório temp existe
    await fs.ensureDir(tempDir);
    
    const tempImagePath = path.join(tempDir, `temp_image_${tempId}.png`);
    const tempPdfPath = path.join(tempDir, `temp_pdf_${tempId}.pdf`);
    
    try {
        // Salvar imagem temporária
        await fs.writeFile(tempImagePath, imageBuffer);
        
        // Abrir imagem com GDAL
        const dataset = await gdal.openAsync(tempImagePath);
        const imageWidth = dataset.rasterSize.x;
        const imageHeight = dataset.rasterSize.y;
        const bandCount = dataset.bands.count();
        
        console.log(`Processando imagem: ${imageWidth}x${imageHeight}, ${bandCount} bandas`);
        
        // Calcular GeoTransform
        const geoTransform = calculateGeoTransform(bounds, imageWidth, imageHeight);
        console.log('GeoTransform calculado:', geoTransform);
        
        // Configurar opções do PDF baseado na orientação
        const pdfOptions = [
            'COMPRESS=DEFLATE',
            'DPI=300',
            'GEOREF_SOURCES=NEATLINE,WKT',
            'GEO_ENCODING=ISO32000',
            `MARGIN=0`,
            'WRITE_USERUNIT=YES'
        ];
        
        // Definir tamanho do papel A4 em pontos (72 DPI)
        if (orientation === 'landscape') {
            pdfOptions.push('PAGE_WIDTH=841.89', 'PAGE_HEIGHT=595.28'); // A4 landscape em pontos
        } else {
            pdfOptions.push('PAGE_WIDTH=595.28', 'PAGE_HEIGHT=841.89'); // A4 portrait em pontos
        }
        
        // Criar driver PDF
        const pdfDriver = gdal.drivers.get('PDF');
        if (!pdfDriver) {
            throw new Error('Driver PDF não está disponível no GDAL');
        }
        
        // Criar dataset PDF georreferenciado
        const pdfDataset = await pdfDriver.createAsync(
            tempPdfPath, 
            imageWidth, 
            imageHeight, 
            bandCount, 
            gdal.GDT_Byte, 
            pdfOptions
        );
        
        // Definir sistema de coordenadas (WGS84)
        const srs = gdal.SpatialReference.fromEPSG(4326);
        pdfDataset.srs = srs;
        
        // Definir geotransform
        pdfDataset.geoTransform = geoTransform;
        
        console.log('Copiando dados da imagem para PDF...');
        
        // Copiar dados da imagem para o PDF
        for (let bandNum = 1; bandNum <= bandCount; bandNum++) {
            const srcBand = dataset.bands.get(bandNum);
            const dstBand = pdfDataset.bands.get(bandNum);
            
            // Ler dados da banda fonte
            const data = srcBand.pixels.read(0, 0, imageWidth, imageHeight);
            
            // Escrever dados na banda destino
            dstBand.pixels.write(0, 0, imageWidth, imageHeight, data);
        }
        
        // Fechar datasets
        await dataset.closeAsync();
        await pdfDataset.closeAsync();
        
        console.log('PDF georreferenciado criado com sucesso');
        
        // Ler PDF gerado
        const pdfBuffer = await fs.readFile(tempPdfPath);
        
        return pdfBuffer;
        
    } catch (error) {
        console.error('Erro na criação do PDF georreferenciado:', error);
        throw new Error(`Erro ao gerar PDF: ${error.message}`);
    } finally {
        // Cleanup arquivos temporários
        await cleanup([tempImagePath, tempPdfPath]);
    }
}

/**
 * Cleanup de arquivos temporários
 */
async function cleanup(filePaths) {
    for (const filePath of filePaths) {
        try {
            if (await fs.pathExists(filePath)) {
                await fs.unlink(filePath);
                console.log(`Arquivo temporário removido: ${filePath}`);
            }
        } catch (error) {
            console.warn(`Erro ao deletar arquivo ${filePath}:`, error.message);
        }
    }
}

/**
 * Handler principal da rota
 */
async function handlePDFExport(req, res) {
    const startTime = Date.now();
    
    try {
        console.log('Iniciando exportação de PDF georreferenciado...');
        
        // 1. Validar input
        const validation = validateInput(req);
        if (!validation.valid) {
            console.log('Validação falhou:', validation.error);
            return res.status(400).json({ 
                error: validation.error,
                code: 'VALIDATION_ERROR'
            });
        }
        
        // 2. Processar imagem
        console.log('Processando imagem...');
        const { imageBuffer, width, height } = await processImage(req.body.image);
        console.log(`Imagem processada: ${width}x${height}, ${imageBuffer.length} bytes`);
        
        // 3. Gerar PDF georreferenciado
        console.log('Gerando PDF georreferenciado...');
        const pdfBuffer = await createGeoreferencedPDF(
            imageBuffer, 
            req.body.bounds, 
            req.body.orientation
        );
        
        // 4. Preparar resposta
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `mapa-georeferenciado-${timestamp}.pdf`;
        
        console.log(`PDF gerado com sucesso: ${pdfBuffer.length} bytes em ${Date.now() - startTime}ms`);
        
        // 5. Enviar resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Erro ao gerar PDF georreferenciado:', error);
        
        // Determinar tipo de erro
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';
        
        if (error.message.includes('Imagem')) {
            statusCode = 400;
            errorCode = 'INVALID_IMAGE';
        } else if (error.message.includes('GDAL') || error.message.includes('Driver')) {
            errorCode = 'GDAL_ERROR';
        } else if (error.message.includes('arquivo') || error.message.includes('temp')) {
            errorCode = 'FILE_ERROR';
        }
        
        res.status(statusCode).json({ 
            error: 'Erro ao processar solicitação de PDF',
            code: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

// Definir rota
router.post('/api/export-georeferenced-pdf', handlePDFExport);

// Rota de teste para verificar se GDAL está funcionando
router.get('/api/export-georeferenced-pdf/status', (req, res) => {
    try {
        const gdalVersion = gdal.version;
        const drivers = gdal.drivers.getNames();
        const hasPDFDriver = drivers.includes('PDF');
        
        res.json({
            status: 'ok',
            gdal: {
                version: gdalVersion,
                pdfSupport: hasPDFDriver,
                availableDrivers: drivers.filter(d => 
                    ['PDF', 'PNG', 'JPEG', 'GTiff'].includes(d)
                )
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: 'GDAL não está disponível',
            details: error.message
        });
    }
});

module.exports = router;