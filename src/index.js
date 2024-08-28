const cluster = require('cluster');
const os = require('os');
require('dotenv').config();
const express = require('express');
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
        WITH intersecting_edificacoes AS (
          SELECT 
            id,
            nome,
            municipio,
            estado,
            tipo,
            altitude_base,
            altitude_topo,
            CASE 
              WHEN $3 < altitude_base THEN altitude_base - $3
              WHEN $3 > altitude_topo THEN $3 - altitude_topo
              ELSE 0
            END AS z_distance
          FROM ng.edificacoes
          WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        )
        SELECT *
        FROM intersecting_edificacoes
        ORDER BY z_distance ASC
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
  
  app.listen(port, () => {
    console.log(`Worker ${process.pid}: Serviço de Nomes Geográficos iniciado na porta ${port}`);
  });
  
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Erro no servidor');
  });
}