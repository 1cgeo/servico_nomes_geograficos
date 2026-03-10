const cluster = require('cluster');
const os = require('os');
require('dotenv').config();
const express = require('express');
const { query, validationResult } = require('express-validator');
const pgp = require('pg-promise')();
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const numCPUs = os.cpus().length;
const numWorkers = Math.max(Math.min(Math.floor(numCPUs / 3), 8), 1);
const MAX_DB_CONNECTIONS = parseInt(process.env.MAX_DB_CONNECTIONS || '80');
const connectionsPerWorker = Math.max(Math.floor(MAX_DB_CONNECTIONS / numWorkers), 2);

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running, spawning ${numWorkers} workers (${connectionsPerWorker} DB connections each)`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}), restarting...`);
    cluster.fork();
  });
} else {
  const app = express();
  const port = process.env.PORT || 3000;

  const db = pgp({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: connectionsPerWorker,
    idleTimeoutMillis: 30000
  });

  const logStream = fs.createWriteStream(path.join(__dirname, 'api-access.log'), { flags: 'a' });
  logStream.on('error', (err) => console.error('Erro no log stream:', err));

  function shutdown() {
    logStream.end();
    pgp.end();
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  app.use(cors());

  app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP-desconhecido';
    logStream.write(`[${new Date().toISOString()}] IP: ${ip} - ${req.method} ${req.originalUrl}\n`);
    next();
  });

  app.get('/busca', [
    query('q').isString().trim().isLength({ min: 3, max: 200 }),
    query('lat').isFloat(),
    query('lon').isFloat(),
    query('zoom').optional().isInt({ min: 1, max: 20 }).toInt()
  ], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q } = req.query;
    const centerLat = parseFloat(req.query.lat);
    const centerLon = parseFloat(req.query.lon);
    const zoom = req.query.zoom ?? null;

    try {
      const result = await db.any(`
        WITH q AS (
          SELECT
            ng.f_unaccent($1) AS term,
            CASE WHEN $4::int IS NOT NULL
              THEN 50000.0 * power(2, 10 - $4::int)
              ELSE 50000.0
            END AS decay_dist,
            CASE WHEN $4::int IS NOT NULL
              THEN GREATEST(0.0, LEAST(($4::int - 4.0) / 14.0, 1.0))
              ELSE 0.0
            END AS zoom_factor
        ),
        candidatos AS (
          SELECT
            n.nome, n.tipo, n.municipio, n.estado, n.geom, n.tipo_peso, n.cluster_id,
            ng.f_unaccent(n.nome) AS nome_clean,
            similarity(ng.f_unaccent(n.nome), q.term) AS sim,
            ST_Distance(
              n.geom::geography,
              ST_SetSRID(ST_MakePoint($3, $2), 4674)::geography
            ) AS dist
          FROM ng.nomes_geograficos n, q
          WHERE similarity(ng.f_unaccent(n.nome), q.term) > 0.25
          ORDER BY sim DESC, dist ASC
          LIMIT 500
        ),
        dedup AS (
          SELECT DISTINCT ON (nome, tipo, cluster_id)
            nome, tipo, municipio, estado, sim, dist, tipo_peso, nome_clean,
            ST_X(geom) AS longitude,
            ST_Y(geom) AS latitude
          FROM candidatos
          ORDER BY nome, tipo, cluster_id, dist ASC
        ),
        q_ref AS (SELECT term, decay_dist, zoom_factor FROM q)
        SELECT
          d.nome, d.tipo, d.municipio, d.estado, d.longitude, d.latitude,
          (
            CASE WHEN lower(d.nome_clean) = lower(q_ref.term)
              THEN 1.0 ELSE 0.0 END * 0.20
            + CASE WHEN lower(d.nome_clean) LIKE lower(q_ref.term) || '%'
              THEN 1.0 ELSE 0.0 END * 0.15
            + d.sim * 0.20
            + (1.0 - abs(length(q_ref.term) - length(d.nome_clean))::float
                    / GREATEST(length(q_ref.term), length(d.nome_clean), 1)) * 0.15
            + (COALESCE(d.tipo_peso, 0.1) * (1.0 - q_ref.zoom_factor) + 0.5 * q_ref.zoom_factor) * 0.10
            + (1.0 / (1.0 + d.dist / q_ref.decay_dist)) * 0.20
          ) AS score
        FROM dedup d, q_ref
        ORDER BY score DESC
        LIMIT 5
      `, [q, centerLat, centerLon, zoom]);

      res.json(result);
    } catch (error) {
      console.error('Erro na query:', error);
      next(error);
    }
  });

  app.get('/feicoes', [
    query('lat').isFloat(),
    query('lon').isFloat(),
    query('z').isFloat()
  ], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pointLat = parseFloat(req.query.lat);
    const pointLon = parseFloat(req.query.lon);
    const pointZ = parseFloat(req.query.z);

    try {
      const result = await db.any(`
        WITH intersecting_edificacoes AS (
          SELECT
            e.id, e.nome, e.municipio, e.estado, e.tipo,
            e.altitude_base, e.altitude_topo,
            CASE
              WHEN $3 < e.altitude_base THEN e.altitude_base - $3
              WHEN $3 > e.altitude_topo THEN $3 - e.altitude_topo
              ELSE 0
            END AS z_distance,
            ST_Distance(
              e.geom::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) AS xy_distance
          FROM ng.edificacoes e
          WHERE ST_DWithin(e.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 3)
        )
        SELECT *
        FROM intersecting_edificacoes
        ORDER BY z_distance ASC, xy_distance ASC
        LIMIT 1
      `, [pointLon, pointLat, pointZ]);

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
      let countQuery = 'SELECT COUNT(*) FROM ng.catalogo_3d';
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

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro no servidor' });
  });

  app.listen(port, () => {
    console.log(`Worker ${process.pid}: Serviço de Nomes Geográficos iniciado na porta ${port}`);
  });
}
