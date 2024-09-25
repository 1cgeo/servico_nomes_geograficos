const cluster = require('cluster');
const os = require('os');
require('dotenv').config();
const express = require('express');
const { query, validationResult } = require('express-validator');
const pgp = require('pg-promise')();
const cors = require("cors");

const numCPUs = os.cpus().length;
const numWorkers = Math.min(Math.floor(numCPUs / 3), 8);

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const app = express();
  const port = process.env.PORT || 3000;

  const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000
  };

  const db = pgp(dbConfig);

  app.use(cors());

  app.get('/busca', async (req, res, next) => {
    const { q, lat, lon } = req.query;
    
    if (!q || q.length < 3) {
      return res.status(400).json({ error: 'Busca deve ter pelo menos 3 caracteres' });
    }

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Ponto central (lat, lon) é obrigatório' });
    }

    const centerLat = parseFloat(lat);
    const centerLon = parseFloat(lon);

    if (isNaN(centerLat) || isNaN(centerLon)) {
      return res.status(400).json({ error: 'Ponto central inválido' });
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
      `, [q, centerLat, centerLon]);
  
      res.json(result);
    } catch (error) {
      console.error('Erro na query:', error);
      next(error);
    }
  });

  app.get('/feicoes', async (req, res, next) => {
    const { lat, lon, z } = req.query;

    if (!lat || !lon || !z) {
      return res.status(400).json({ error: 'Coordenadas (lat, lon, z) são obrigatórias' });
    }

    const pointLat = parseFloat(lat);
    const pointLon = parseFloat(lon);
    const pointZ = parseFloat(z);

    if (isNaN(pointLat) || isNaN(pointLon) || isNaN(pointZ)) {
      return res.status(400).json({ error: 'Coordenadas inválidas' });
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
      let countQuery = `SELECT COUNT(*) FROM ng.catalago_3d`;
      let dataQuery = `
      SELECT id, name, description, thumbnail, url, lon, lat, height, heading, pitch, roll, type, 
             heightOffset, maximumScreenSpaceError, data_criacao, municipio, estado, palavras_chave
        FROM ng.catalago_3d
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
  
  app.listen(port, () => {
    console.log(`Worker ${process.pid}: Serviço de Nomes Geográficos iniciado na porta ${port}`);
  });
  
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Erro no servidor');
  });
}