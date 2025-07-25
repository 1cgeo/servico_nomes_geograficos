const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ===== CONFIGURAÇÕES =====
const MISSIONS_PATH = process.env.MISSIONS_PATH || './missions';
const MAX_CONNECTIONS = parseInt(process.env.MAX_SQLITE_CONNECTIONS) || 20;
const CONNECTION_TIMEOUT = parseInt(process.env.SQLITE_TIMEOUT) || 30000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 86400; // 24h em segundos

// ===== SANITIZAÇÃO E VALIDAÇÃO =====
function sanitizeMissionId(missionId) {
  if (!missionId || typeof missionId !== 'string') {
    throw new Error('ID da missão inválido');
  }

  // Remove caracteres perigosos e limita tamanho
  const sanitized = missionId.replace(/[^a-zA-Z0-9_-]/g, '');
  
  if (sanitized.length === 0 || sanitized.length > 50) {
    throw new Error('ID da missão deve conter apenas letras, números, hífen e underscore (max 50 chars)');
  }

  // Previne path traversal
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    throw new Error('ID da missão contém caracteres não permitidos');
  }

  return sanitized;
}

function validatePanoramaId(panoramaId) {
  const id = parseInt(panoramaId);
  
  if (!id || id <= 0 || id > 999999999) { // Limite razoável
    throw new Error('ID do panorama deve ser um número positivo válido');
  }

  return id;
}

// ===== POOL DE CONEXÕES MELHORADO =====
class ImprovedSQLitePool {
  constructor(maxConnections = MAX_CONNECTIONS) {
    this.maxConnections = maxConnections;
    this.connections = new Map();
    this.accessOrder = []; // Para LRU mais eficiente
    this.pending = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      creates: 0,
      errors: 0,
      evictions: 0
    };
  }

  async getConnection(missionId) {
    const sanitizedId = sanitizeMissionId(missionId);
    
    // Cache hit
    if (this.connections.has(sanitizedId)) {
      this.updateLRU(sanitizedId);
      this.stats.hits++;
      return this.connections.get(sanitizedId);
    }

    this.stats.misses++;

    // Conexão pendente
    if (this.pending.has(sanitizedId)) {
      return await this.pending.get(sanitizedId);
    }

    // Evict se necessário
    if (this.connections.size >= this.maxConnections) {
      await this.evictOldest();
    }

    // Criar nova conexão
    const connectionPromise = this.createConnection(sanitizedId);
    this.pending.set(sanitizedId, connectionPromise);

    try {
      const connection = await connectionPromise;
      this.connections.set(sanitizedId, connection);
      this.updateLRU(sanitizedId);
      this.pending.delete(sanitizedId);
      this.stats.creates++;
      return connection;
    } catch (error) {
      this.pending.delete(sanitizedId);
      this.stats.errors++;
      throw error;
    }
  }

  async createConnection(missionId) {
    const dbPath = path.join(MISSIONS_PATH, `missao_${missionId}.db`);
    
    // Verificação segura do arquivo
    try {
      const stats = await fs.promises.stat(dbPath);
      if (!stats.isFile()) {
        throw new Error(`Caminho não é um arquivo válido: ${missionId}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Missão '${missionId}' não encontrada`);
      }
      throw new Error(`Erro acessando missão '${missionId}': ${error.message}`);
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, async (err) => {
        if (err) {
          reject(new Error(`Erro abrindo banco ${missionId}: ${err.message}`));
          return;
        }

        try {
          const asyncDb = this.createAsyncWrapper(db);
          await this.configureSQLite(asyncDb);
          await this.prepareStatements(asyncDb);
          
          // Adicionar metadata
          asyncDb._metadata = {
            missionId,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            dbPath
          };

          console.log(`SQLite connection created for ${missionId} in ${Date.now() - startTime}ms`);
          resolve(asyncDb);

        } catch (setupError) {
          db.close();
          reject(new Error(`Erro configurando SQLite para ${missionId}: ${setupError.message}`));
        }
      });

      // Timeout para criação de conexão
      setTimeout(() => {
        db.close();
        reject(new Error(`Timeout criando conexão para ${missionId}`));
      }, CONNECTION_TIMEOUT);
    });
  }

  createAsyncWrapper(db) {
    return {
      db: db,
      get: promisify(db.get.bind(db)),
      run: promisify(db.run.bind(db)),
      close: promisify(db.close.bind(db)),
      prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
          get: promisify(stmt.get.bind(stmt)),
          finalize: promisify(stmt.finalize.bind(stmt))
        };
      }
    };
  }

  async configureSQLite(asyncDb) {
    const pragmas = [
      "PRAGMA cache_size = -65536",
      "PRAGMA temp_store = MEMORY", 
      "PRAGMA mmap_size = 268435456",
      "PRAGMA journal_mode = WAL",
      "PRAGMA synchronous = NORMAL",
      "PRAGMA read_uncommitted = true",
      "PRAGMA busy_timeout = 5000"
    ];

    for (const pragma of pragmas) {
      await asyncDb.run(pragma);
    }
  }

  async prepareStatements(asyncDb) {
    // Prepared statement principal
    asyncDb.panoramaStmt = asyncDb.prepare(`
      SELECT 
        image_data,
        COALESCE(content_type, 'image/jpeg') as content_type,
        filename
      FROM panoramas 
      WHERE id = ? 
      LIMIT 1
    `);
  }

  updateLRU(missionId) {
    // Remove da posição atual
    const index = this.accessOrder.indexOf(missionId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Adiciona ao final (mais recente)
    this.accessOrder.push(missionId);
    
    // Atualiza timestamp de acesso
    const connection = this.connections.get(missionId);
    if (connection && connection._metadata) {
      connection._metadata.lastAccessed = Date.now();
    }
  }

  async evictOldest() {
    if (this.accessOrder.length === 0) return;
    
    const oldest = this.accessOrder[0];
    await this.closeConnection(oldest);
    this.stats.evictions++;
  }

  async closeConnection(missionId) {
    const connection = this.connections.get(missionId);
    if (!connection) return;

    try {
      // Finalizar prepared statements
      if (connection.panoramaStmt) {
        await connection.panoramaStmt.finalize().catch(() => {});
      }
      
      // Fechar conexão
      await connection.close();
      
      console.log(`SQLite connection closed for ${missionId}`);
    } catch (error) {
      console.error(`Erro fechando conexão ${missionId}:`, error);
    } finally {
      // Sempre remover do pool
      this.connections.delete(missionId);
      const index = this.accessOrder.indexOf(missionId);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }

  async closeAll() {
    const closePromises = Array.from(this.connections.keys()).map(missionId => 
      this.closeConnection(missionId)
    );
    
    await Promise.allSettled(closePromises);
    
    // Limpar estruturas
    this.connections.clear();
    this.accessOrder.length = 0;
    this.pending.clear();
  }

  getStats() {
    const connections = Array.from(this.connections.values()).map(conn => ({
      missionId: conn._metadata?.missionId,
      createdAt: conn._metadata?.createdAt,
      lastAccessed: conn._metadata?.lastAccessed,
      ageMs: Date.now() - (conn._metadata?.createdAt || 0)
    }));

    return {
      activeConnections: this.connections.size,
      maxConnections: this.maxConnections,
      pendingConnections: this.pending.size,
      ...this.stats,
      connections
    };
  }

  // Limpeza automática de conexões antigas
  startCleanupInterval(intervalMs = 300000) { // 5 minutos
    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutos
      
      for (const [missionId, connection] of this.connections) {
        if (connection._metadata && (now - connection._metadata.lastAccessed) > maxAge) {
          console.log(`Auto-closing old connection: ${missionId}`);
          await this.closeConnection(missionId);
        }
      }
    }, intervalMs);
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ===== INSTÂNCIA GLOBAL DO POOL =====
const sqlitePool = new ImprovedSQLitePool();
sqlitePool.startCleanupInterval();

// ===== ROTAS =====

// Rota principal: servir panorama
router.get('/panorama/:mission_id/:panorama_id', async (req, res) => {
  try {
    // Validação e sanitização
    const missionId = sanitizeMissionId(req.params.mission_id);
    const panoramaId = validatePanoramaId(req.params.panorama_id);

    // Headers de segurança
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });

    // Verificar cache do cliente
    const etag = `"${missionId}-${panoramaId}"`;
    const ifNoneMatch = req.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }

    // Obter conexão
    const connection = await sqlitePool.getConnection(missionId);
    
    // Buscar panorama
    const row = await connection.panoramaStmt.get(panoramaId);

    if (!row) {
      return res.status(404).json({ 
        error: 'Panorama não encontrado',
        mission: missionId,
        panorama: panoramaId
      });
    }

    // Headers otimizados
    res.set({
      'Content-Type': row.content_type,
      'Content-Length': row.image_data.length,
      'Cache-Control': `public, max-age=${CACHE_TTL}, immutable`,
      'ETag': etag
    });

    if (row.filename) {
      res.set('Content-Disposition', `inline; filename="${row.filename}"`);
    }

    // Enviar imagem
    res.send(row.image_data);

  } catch (error) {
    console.error(`Panorama request error:`, {
      mission: req.params.mission_id,
      panorama: req.params.panorama_id,
      error: error.message,
      stack: error.stack
    });

    if (error.message.includes('não encontrada') || error.message.includes('não encontrado')) {
      return res.status(404).json({ 
        error: error.message,
        mission: req.params.mission_id 
      });
    }
    
    if (error.message.includes('inválido')) {
      return res.status(400).json({ 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }
});

// Rota de status detalhada
router.get('/status', (req, res) => {
  const stats = sqlitePool.getStats();
  
  res.json({
    status: 'OK',
    sqlite_pool: stats,
    worker_pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    config: {
      missions_path: MISSIONS_PATH,
      max_connections: MAX_CONNECTIONS,
      connection_timeout: CONNECTION_TIMEOUT,
      cache_ttl: CACHE_TTL
    }
  });
});

// ===== CLEANUP E SHUTDOWN =====
async function gracefulShutdown() {
  console.log('Streetview router: Iniciando graceful shutdown...');
  
  sqlitePool.stopCleanup();
  await sqlitePool.closeAll();
  
  console.log('Streetview router: Shutdown completo');
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Cleanup automático em caso de worker restart
if (process.send) {
  process.on('disconnect', gracefulShutdown);
}

module.exports = router;