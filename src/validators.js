// ===== VALIDAÇÕES GEOGRÁFICAS ROBUSTAS =====

const path = require('path');

/**
 * Valida coordenadas geográficas com verificações abrangentes
 * @param {string|number} lat - Latitude
 * @param {string|number} lon - Longitude  
 * @param {object} options - Opções de validação
 * @returns {object} Resultado da validação
 */
function validateCoordinates(lat, lon, options = {}) {
  const {
    checkRange = true,
    precision = 6 // Máximo de casas decimais
  } = options;

  // Conversão para número
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  // Verificação básica de tipo
  if (isNaN(latitude) || isNaN(longitude)) {
    return { 
      valid: false, 
      error: 'Coordenadas devem ser números válidos',
      details: { lat: isNaN(latitude), lon: isNaN(longitude) }
    };
  }

  // Verificação de infinito
  if (!isFinite(latitude) || !isFinite(longitude)) {
    return { 
      valid: false, 
      error: 'Coordenadas não podem ser infinitas' 
    };
  }

  // Verificação de precisão (evita coordenadas falsas muito precisas)
  const latStr = latitude.toString();
  const lonStr = longitude.toString();
  
  if (latStr.includes('.') && latStr.split('.')[1].length > precision) {
    return { 
      valid: false, 
      error: `Latitude não pode ter mais de ${precision} casas decimais` 
    };
  }
  
  if (lonStr.includes('.') && lonStr.split('.')[1].length > precision) {
    return { 
      valid: false, 
      error: `Longitude não pode ter mais de ${precision} casas decimais` 
    };
  }

  if (!checkRange) {
    return { 
      valid: true, 
      lat: latitude, 
      lon: longitude,
      normalized: {
        lat: parseFloat(latitude.toFixed(6)),
        lon: parseFloat(longitude.toFixed(6))
      }
    };
  }

  // Validação de ranges geográficos padrão
  if (latitude < -90 || latitude > 90) {
    return { 
      valid: false, 
      error: 'Latitude deve estar entre -90 e 90 graus',
      received: latitude 
    };
  }

  if (longitude < -180 || longitude > 180) {
    return { 
      valid: false, 
      error: 'Longitude deve estar entre -180 e 180 graus',
      received: longitude 
    };
  }

  // Verificação de coordenadas obviamente inválidas
  if (latitude === 0 && longitude === 0) {
    return { 
      valid: false, 
      error: 'Coordenadas 0,0 não são válidas para este contexto' 
    };
  }

  const result = { 
    valid: true, 
    lat: latitude, 
    lon: longitude,
    normalized: {
      lat: parseFloat(latitude.toFixed(6)),
      lon: parseFloat(longitude.toFixed(6))
    }
  };

  return result;
}

/**
 * Valida altitude com verificações contextuais
 * @param {string|number} altitude - Valor da altitude
 * @param {object} options - Opções de validação
 * @returns {object} Resultado da validação
 */
function validateAltitude(altitude, options = {}) {
  const {
    minAltitude = -500, // Abaixo do nível do mar
    maxAltitude = 9000, // Altitude máxima razoável mundial
    context = 'general' // 'general', 'urban', 'aviation'
  } = options;

  const alt = parseFloat(altitude);
  
  if (isNaN(alt)) {
    return { 
      valid: false, 
      error: 'Altitude deve ser um número válido' 
    };
  }

  if (!isFinite(alt)) {
    return { 
      valid: false, 
      error: 'Altitude não pode ser infinita' 
    };
  }

  // Ajustar limites baseado no contexto
  let min = minAltitude;
  let max = maxAltitude;

  switch (context) {
    case 'urban':
      min = -100;
      max = 2000; // Cidades em altitude
      break;
    case 'aviation':
      min = -500;
      max = 15000; // Altitude de voo
      break;
  }

  if (alt < min || alt > max) {
    return { 
      valid: false, 
      error: `Altitude deve estar entre ${min}m e ${max}m para contexto '${context}'`,
      received: alt,
      context: context
    };
  }

  return { 
    valid: true, 
    altitude: alt,
    normalized: parseFloat(alt.toFixed(1)),
    context: context
  };
}

/**
 * Valida bounds geográficos (retângulo de coordenadas)
 * @param {object} bounds - Objeto com west, east, north, south
 * @param {object} options - Opções de validação
 * @returns {object} Resultado da validação
 */
function validateBounds(bounds, options = {}) {
  if (!bounds || typeof bounds !== 'object') {
    return { 
      valid: false, 
      error: 'Bounds deve ser um objeto' 
    };
  }

  const { west, east, north, south } = bounds;

  // Verificar se todas as propriedades existem
  if (west === undefined || east === undefined || north === undefined || south === undefined) {
    return { 
      valid: false, 
      error: 'Bounds deve conter west, east, north e south',
      missing: {
        west: west === undefined,
        east: east === undefined, 
        north: north === undefined,
        south: south === undefined
      }
    };
  }

  // Validar cada coordenada
  const westValidation = validateCoordinates(south, west, options);
  const eastValidation = validateCoordinates(north, east, options);

  if (!westValidation.valid) {
    return { 
      valid: false, 
      error: `West/South inválidos: ${westValidation.error}` 
    };
  }

  if (!eastValidation.valid) {
    return { 
      valid: false, 
      error: `East/North inválidos: ${eastValidation.error}` 
    };
  }

  // Converter para números
  const w = parseFloat(west);
  const e = parseFloat(east);
  const n = parseFloat(north);
  const s = parseFloat(south);

  // Verificar ordem lógica
  if (w >= e) {
    return { 
      valid: false, 
      error: 'West deve ser menor que East',
      received: { west: w, east: e }
    };
  }

  if (s >= n) {
    return { 
      valid: false, 
      error: 'South deve ser menor que North',
      received: { south: s, north: n }
    };
  }

  // Verificar se o retângulo não é muito pequeno (pode indicar erro)
  const width = e - w;
  const height = n - s;
  
  if (width < 0.000001 || height < 0.000001) {
    return { 
      valid: false, 
      error: 'Bounds muito pequenos (possível erro de precisão)',
      dimensions: { width, height }
    };
  }

  // Verificar se não é muito grande (globo inteiro)
  if (width > 180 || height > 90) {
    return { 
      valid: false, 
      error: 'Bounds muito grandes',
      dimensions: { width, height }
    };
  }

  const result = {
    valid: true,
    bounds: {
      west: w,
      east: e, 
      north: n,
      south: s
    },
    normalized: {
      west: parseFloat(w.toFixed(6)),
      east: parseFloat(e.toFixed(6)),
      north: parseFloat(n.toFixed(6)),
      south: parseFloat(s.toFixed(6))
    },
    dimensions: { width, height },
    area: width * height // Área aproximada em graus quadrados
  };

  return result;
}

/**
 * Valida DPI para geração de PDFs
 * @param {string|number} dpi - Valor do DPI
 * @returns {object} Resultado da validação
 */
function validateDPI(dpi) {
  const dpiValue = parseInt(dpi);
  
  if (isNaN(dpiValue)) {
    return { 
      valid: false, 
      error: 'DPI deve ser um número inteiro' 
    };
  }

  if (dpiValue < 72 || dpiValue > 600) {
    return { 
      valid: false, 
      error: 'DPI deve estar entre 72 e 600',
      received: dpiValue 
    };
  }

  // DPIs comuns para validação adicional
  const commonDPIs = [72, 96, 150, 200, 300, 600];
  const isCommon = commonDPIs.includes(dpiValue);

  return { 
    valid: true, 
    dpi: dpiValue,
    isCommon: isCommon,
    warning: isCommon ? null : 'DPI não é um valor padrão comum'
  };
}

/**
 * Valida dimensões de imagem
 * @param {string|number} width - Largura
 * @param {string|number} height - Altura  
 * @returns {object} Resultado da validação
 */
function validateImageDimensions(width, height) {
  const w = parseInt(width);
  const h = parseInt(height);
  
  if (isNaN(w) || isNaN(h)) {
    return { 
      valid: false, 
      error: 'Dimensões devem ser números inteiros' 
    };
  }

  if (w <= 0 || h <= 0) {
    return { 
      valid: false, 
      error: 'Dimensões devem ser positivas',
      received: { width: w, height: h }
    };
  }

  // Limites razoáveis para evitar problemas de memória
  const maxDimension = 50000; // 50k pixels
  const maxPixels = 100000000; // 100 megapixels

  if (w > maxDimension || h > maxDimension) {
    return { 
      valid: false, 
      error: `Dimensões muito grandes (max: ${maxDimension}px)`,
      received: { width: w, height: h }
    };
  }

  const totalPixels = w * h;
  if (totalPixels > maxPixels) {
    return { 
      valid: false, 
      error: `Imagem muito grande (max: ${maxPixels / 1000000}MP)`,
      received: { width: w, height: h, megapixels: totalPixels / 1000000 }
    };
  }

  return { 
    valid: true, 
    width: w, 
    height: h,
    megapixels: parseFloat((totalPixels / 1000000).toFixed(2)),
    aspectRatio: parseFloat((w / h).toFixed(3))
  };
}

/**
 * Sanitiza string para prevenir injection
 * @param {string} input - String de entrada
 * @param {object} options - Opções de sanitização
 * @returns {string} String sanitizada
 */
function sanitizeString(input, options = {}) {
  const {
    allowedChars = /^[a-zA-Z0-9_-]*$/,
    maxLength = 100,
    replaceChar = ''
  } = options;

  if (typeof input !== 'string') {
    throw new Error('Input deve ser uma string');
  }

  if (input.length > maxLength) {
    throw new Error(`String muito longa (max: ${maxLength})`);
  }

  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, replaceChar);
  
  if (!allowedChars.test(sanitized)) {
    throw new Error('String contém caracteres não permitidos');
  }

  return sanitized;
}

/**
 * Valida formato e extensão de arquivo
 * @param {string} filename - Nome do arquivo
 * @param {array} allowedExtensions - Extensões permitidas
 * @returns {object} Resultado da validação
 */
function validateFileFormat(filename, allowedExtensions = ['.png', '.jpg', '.jpeg']) {
  if (!filename || typeof filename !== 'string') {
    return { 
      valid: false, 
      error: 'Nome do arquivo deve ser uma string válida' 
    };
  }

  const ext = path.extname(filename).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return { 
      valid: false, 
      error: `Extensão não permitida. Permitidas: ${allowedExtensions.join(', ')}`,
      received: ext
    };
  }

  // Verificar caracteres perigosos no nome do arquivo
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    return { 
      valid: false, 
      error: 'Nome do arquivo contém caracteres não permitidos' 
    };
  }

  return { 
    valid: true, 
    filename: filename,
    extension: ext,
    basename: path.basename(filename, ext)
  };
}

module.exports = {
  validateCoordinates,
  validateAltitude,
  validateBounds,
  validateDPI,
  validateImageDimensions,
  validateFileFormat,
  sanitizeString
};