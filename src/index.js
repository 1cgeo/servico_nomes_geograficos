const cluster = require('cluster');
const os = require('os');
require('dotenv').config();
const express = require('express');
const { query, validationResult } = require('express-validator');
const pgp = require('pg-promise')();
const cors = require("cors");
const georefPdfRouter = require('./georefPdf');
const streetviewRouter = require('./streetview');

// ===== CONFIGURAÇÕES CLUSTER =====
const numCPUs = os.cpus().length;
const numWorkers = Math.min(Math.floor(numCPUs / 2), 8);
const RESTART_DELAY = 2000;
const MAX_RESTARTS_PER_HOUR = 10;

// Controle de restarts por worker
const workerRestarts = new Map();

const { 
  validateCoordinates, 
  validateAltitude 
} = require('./validators');

if (cluster.isMaster) {
  console.log(`Master ${process.pid} iniciando com ${numWorkers} workers`);

  // Função para reiniciar worker com controle de rate
  function restartWorker(workerId) {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Limpar restarts antigos
    const restarts = workerRestarts.get(workerId) || [];
    const recentRestarts = restarts.filter(time => time > oneHourAgo);
    
    if (recentRestarts.length >= MAX_RESTARTS_PER_HOUR) {
      console.error(`Worker ${workerId} excedeu limite de restarts por hora. Não reiniciando.`);
      return;
    }
    
    // Registrar restart
    recentRestarts.push(now);
    workerRestarts.set(workerId, recentRestarts);
    
    // Reiniciar após delay
    setTimeout(() => {
      console.log(`Reiniciando worker ${workerId}...`);
      cluster.fork();
    }, RESTART_DELAY);
  }

  // Fork inicial dos workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} morreu (code: ${code}, signal: ${signal})`);
    
    if (!worker.exitedAfterDisconnect) {
      restartWorker(worker.id);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Master recebeu SIGTERM, iniciando graceful shutdown...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
    
    setTimeout(() => {
      console.log('Forçando saída do master...');
      process.exit(0);
    }, 10000);
  });

  process.on('SIGINT', () => {
    console.log('Master recebeu SIGINT, iniciando graceful shutdown...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGINT');
    }
    
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

} else {
  // ===== WORKER PROCESS =====
  
  const app = express();
  const port = process.env.PORT || 3000;

  // ===== SETUP DB E CORS =====
  const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: Math.max(numWorkers * 3, 15), // Pool dimensionado para workers
    min: 2, // Conexões mínimas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true
  };

  const db = pgp(dbConfig);

  // Teste de conexão inicial
  db.connect()
    .then(obj => {
      console.log(`Worker ${process.pid}: Conexão DB estabelecida`);
      obj.done();
    })
    .catch(error => {
      console.error(`Worker ${process.pid}: Erro conectando ao DB:`, error);
      process.exit(1);
    });

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
  }));
  
  // Routers
  app.use('/pdf', georefPdfRouter);
  app.use('/streetview', streetviewRouter);

  app.get('/busca', async (req, res, next) => {
    const { q, lat, lon } = req.query;
    
    if (!q || q.length < 3) {
      return res.status(400).json({ error: 'Busca deve ter pelo menos 3 caracteres' });
    }

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Ponto central (lat, lon) é obrigatório' });
    }

    const coordValidation = validateCoordinates(lat, lon);
    if (!coordValidation.valid) {
      return res.status(400).json({ error: coordValidation.error });
    }

    try {
      const result = await db.any(`
        WITH ranked_features AS (
          SELECT 
            nome,
            ST_X(geom) AS longitude,
            ST_Y(geom) AS latitude,
            municipio,
            estado,
            tipo,
            similarity(nome, $1) AS name_similarity,
            ST_Distance(
              geom::geography, 
              ST_SetSRID(ST_MakePoint($3, $2), 4674)::geography
            ) AS distance_to_center
          FROM ng.nomes_geograficos
          ORDER BY name_similarity DESC, distance_to_center ASC
          LIMIT 50
        )
        SELECT *,
          (name_similarity * 0.7 + (1 - LEAST(distance_to_center / 1000000, 1)) * 0.3) AS relevance_score
        FROM ranked_features
        ORDER BY relevance_score DESC
        LIMIT 5
      `, [q, coordValidation.lat, coordValidation.lon]);
  
      res.json(result);
    } catch (error) {
      console.error('Erro na query de busca:', error);
      next(error);
    }
  });

  app.get('/feicoes', async (req, res, next) => {
    const { lat, lon, z } = req.query;

    if (!lat || !lon || !z) {
      return res.status(400).json({ error: 'Coordenadas (lat, lon, z) são obrigatórias' });
    }

    const coordValidation = validateCoordinates(lat, lon);
    if (!coordValidation.valid) {
      return res.status(400).json({ error: coordValidation.error });
    }

    const altValidation = validateAltitude(z);
    if (!altValidation.valid) {
      return res.status(400).json({ error: altValidation.error });
    }

    try {
      const result = await db.any(`
        WITH click_point AS (
          SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom
        ),
        buffered_point AS (
          SELECT ST_Buffer(geom::geography, 3)::geometry AS geom FROM click_point
        ),
        intersecting_edificacoes AS (
          SELECT 
            e.id,
            e.nome,
            e.municipio,
            e.estado,
            e.tipo,
            e.altitude_base,
            e.altitude_topo,
            CASE 
              WHEN $3 < e.altitude_base THEN e.altitude_base - $3
              WHEN $3 > e.altitude_topo THEN $3 - e.altitude_topo
              ELSE 0
            END AS z_distance,
            ST_Distance(e.geom, c.geom) AS xy_distance
          FROM ng.edificacoes e
          INNER JOIN buffered_point bp ON bp.geom && e.geom
          INNER JOIN click_point c ON c.geom && bp.geom
          WHERE ST_Intersects(e.geom, bp.geom) AND ST_Intersects(c.geom, bp.geom)
        )
        SELECT *
        FROM intersecting_edificacoes
        ORDER BY z_distance ASC, xy_distance ASC
        LIMIT 1
      `, [coordValidation.normalized.lon, coordValidation.normalized.lat, altValidation.normalized]);
  
      if (result.length === 0) {
        res.json({ message: 'Nenhuma edificação encontrada para as coordenadas fornecidas.' });
      } else {
        res.json(result[0]);
      }
    } catch (error) {
      console.error('Erro na query de feições:', error);
      next(error);
    }
  });

  app.get('/catalogo3d', [
    query('q').optional().isString().trim().escape(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('nr_records').optional().isInt({ min: 1, max: 100 }).toInt()
  ], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    const { q, page = 1, nr_records = 10 } = req.query;
    const offset = (page - 1) * nr_records;
    
    try {
      let countQuery = `SELECT COUNT(*) FROM ng.catalogo_3d`;
      let dataQuery = `
      SELECT id, name, description, thumbnail, url, lon, lat, height, heading, pitch, roll, type, 
             heightoffset, maximumscreenspaceerror, data_criacao, municipio, estado, palavras_chave, style
        FROM ng.catalogo_3d
      `;
      
      const queryParams = [];
      
      if (q) {
        const whereClause = `WHERE search_vector @@ plainto_tsquery('portuguese', $1)`;
        countQuery += ` ${whereClause}`;
        dataQuery += ` ${whereClause}`;
        queryParams.push(q);
      }
      
      dataQuery += `
        ORDER BY 
          CASE WHEN $${queryParams.length + 1} IS NOT NULL 
            THEN ts_rank(search_vector, plainto_tsquery('portuguese', $${queryParams.length + 1})) 
            ELSE 0 
          END DESC,
          data_criacao DESC
        LIMIT $${queryParams.length + 2} OFFSET $${queryParams.length + 3}
      `;
      queryParams.push(q, nr_records, offset);

      const [totalCount, data] = await Promise.all([
        db.one(countQuery, q ? [q] : []),
        db.any(dataQuery, queryParams)
      ]);

      res.json({
        total: parseInt(totalCount.count),
        page,
        nr_records,
        data
      });
    } catch (error) {
      console.error('Erro na query do catálogo 3D:', error);
      next(error);
    }
  });

  // ===== HEALTH CHECK =====
  app.get('/status', async (req, res) => {
    try {
      // Teste rápido de DB
      await db.one('SELECT 1 as test');
      
      res.json({
        status: 'OK',
        worker: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        db_status: 'connected'
      });
    } catch (error) {
      res.status(503).json({
        status: 'ERROR',
        worker: process.pid,
        db_status: 'disconnected',
        error: error.message
      });
    }
  });
  
  // ===== SERVER START =====
  const server = app.listen(port, () => {
    console.log(`Worker ${process.pid}: Serviço iniciado na porta ${port}`);
  });

  // ===== GRACEFUL SHUTDOWN =====
  function gracefulShutdown(signal) {
    console.log(`Worker ${process.pid}: Recebido ${signal}, iniciando graceful shutdown...`);
    
    server.close(() => {
      console.log(`Worker ${process.pid}: HTTP server fechado`);
      
      // Fechar conexões DB
      pgp.end();
      
      console.log(`Worker ${process.pid}: Graceful shutdown completo`);
      process.exit(0);
    });
    
    // Forçar saída após timeout
    setTimeout(() => {
      console.log(`Worker ${process.pid}: Forçando saída após timeout`);
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // ===== ERROR HANDLER =====
  app.use((err, req, res, next) => {
    console.error(`Worker ${process.pid}: Erro:`, err.stack);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      });
    }
  });
}