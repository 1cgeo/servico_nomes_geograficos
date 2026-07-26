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

  // ==========================================================================
  // GET /busca — ordenacao em TRES CHAVES LEXICOGRAFICAS, nao em soma ponderada
  // ==========================================================================
  // Ate 2026-07-26 isto era uma soma de 7 criterios com pesos somando 1.00. A troca
  // nao foi opiniao: foi medida contra um conjunto dourado de 584 casos em 13
  // familias, com ablacao por criterio e holdout. Aprovacao 81,5% -> 92,6%.
  //
  // A DOUTRINA: vence a feicao de MAIOR IMPORTANCIA mais PROXIMA do local, com a
  // importancia sendo CATEGORICA e nao de entidade. Cidade e muito importante e vem
  // primeiro INDEPENDENTE da distancia; nao existe ranking entre cidades. Abaixo
  // desse degrau vale a combinacao de proximidade e importancia. E a triade que o
  // Google documenta para resultado local (relevancia, distancia, proeminencia).
  //
  // POR QUE CHAVES E NAO SOMA: numa soma — e tambem num produto — distancia
  // suficiente sempre COMPRA a diferenca de categoria, porque as duas moram na mesma
  // unidade. Nao existe peso que torne "cidade" incomparavel: so torna caro. Uma
  // chave lexicografica nao se compra. O caso que decide e uma Cidade do mesmo nome
  // a ~330 km: 85,7% de acerto com a soma (recalibrada ou nao), 47,6% com produto
  // multiplicativo e decaimento gaussiano, 100% com as tres chaves.
  //
  // AS CHAVES:
  //   1. RELEVANCIA em faixa, com CONTAINMENT valendo casamento PLENO. Digitar
  //      "Altamira" com o mapa em cima de "Altamira do Parana" e prefixo legitimo,
  //      nao erro; o trigrama pune o comprimento (1,00 contra ~0,53) e jogaria os
  //      dois em faixas diferentes, onde a categoria nunca votaria.
  //   2. CATEGORIA: tipo_peso >= 1.0, ou seja, so Cidade. Baixar para 0.9 mede pior.
  //   3. COMBINACAO: importancia^0.3 vezes decaimento gaussiano com PLATO de 10 km,
  //      dentro do qual a distancia nao penaliza nada. O expoente 0.3 comprime a
  //      importancia: com expoente 1, multiplicar por tipo_peso = 0.1 divide por dez
  //      quem esta no piso (23% do acervo) e enterra resultado legitimo.
  //   4. DESEMPATE por trigrama cru. Nao melhora ranking (medido: zero efeito);
  //      existe por DETERMINISMO, senao candidatos identicos nas tres primeiras
  //      chaves ordenam pelo que o plano devolver, e plano muda com volume.
  //
  // O campo `score` continua saindo e continua em [0,1]: e a tupla codificada numa
  // base que preserva a ordem (faixa domina tier, que domina combinacao), entao
  // ORDER BY score DESC E a ordem das chaves e quem consome le um numero decrescente.
  //
  // ZOOM afia SO O ESPACO (plato e escala encolhem com 2^(10-zoom)). O antigo
  // zoom_factor, que neutralizava tipo_peso em zoom alto, foi REMOVIDO: ele
  // contradiz a chave 2 frontalmente.
  //
  // O LEAST(..., 700) no expoente NAO e paranoia: o Postgres LANCA ERRO em underflow
  // de float em vez de saturar em zero, e com zoom 16 um candidato a 300 km da
  // expoente 4096, derrubando a requisicao inteira com 22003.
  //
  // PRE-REQUISITO DE DADO: este ranking pressupoe o acervo corrigido por
  // dev/atualizar-acervo.sql (deduplicado, tipo_peso por palavra, clusters
  // recomputados). Sem isso a chave 2 vale pouco, porque 38% do acervo fica no piso.
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
      // A transacao existe SO pelo SET LOCAL. O predicado usa o OPERADOR % do pg_trgm
      // para alcancar o indice GIN (idx_ng_nome_unaccent_trgm), e o operador le o
      // limiar de pg_trgm.similarity_threshold, cujo default e 0.3 — enquanto o
      // predicado antigo (similarity(...) > 0.25) comparava contra 0.25. Sem fixar o
      // limiar aqui, a troca teria apertado a busca em SILENCIO, descartando os
      // candidatos entre 0.25 e 0.3.
      //
      // SET LOCAL (e nao SET) para o valor morrer com a transacao e nao vazar para a
      // proxima query que pegar a mesma conexao do pool.
      //
      // Por que trocar o predicado: uma chamada de funcao e opaca ao planner e forca
      // Seq Scan sobre a ng.nomes_geograficos inteira, avaliando f_unaccent() e
      // similarity() linha a linha e so entao ST_Distance() sobre cada candidato. O
      // indice que resolve isso ja existia e estava ocioso.
      const result = await db.tx(async (t) => {
        await t.none('SET LOCAL pg_trgm.similarity_threshold = 0.25');
        return t.any(`
        WITH q AS (
          SELECT
            ng.f_unaccent($1) AS term,
            -- Constantes calibradas contra um conjunto dourado de 584 casos.
            0.15::float8 AS faixa_casamento,
            1.0::float8  AS tier_min,
            0.3::float8  AS gama,
            CASE WHEN $4::int IS NOT NULL THEN  10.0 * power(2, 10 - $4::int) ELSE  10.0 END AS plato_km,
            CASE WHEN $4::int IS NOT NULL THEN 300.0 * power(2, 10 - $4::int) ELSE 300.0 END AS escala_km
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
          -- O termo vem do PARAMETRO, nao de q.term: a CTE q e referenciada mais de
          -- uma vez, entao o Postgres a MATERIALIZA e q.term deixa de ser constante
          -- para o planner, que volta ao Seq Scan mesmo com o operador certo.
          WHERE ng.f_unaccent(n.nome) % ng.f_unaccent($1)
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
        pontuado AS (
          SELECT d.nome, d.tipo, d.municipio, d.estado, d.longitude, d.latitude, d.sim,
            floor(
              (CASE WHEN lower(d.nome_clean) LIKE '%' || lower(q.term) || '%'
                    THEN 1.0 ELSE d.sim END)
              / q.faixa_casamento
            ) AS faixa,
            CASE WHEN COALESCE(d.tipo_peso, 0.1) >= q.tier_min THEN 1 ELSE 0 END AS tier,
            (
              power(COALESCE(d.tipo_peso, 0.1), q.gama)
              * power(0.5, LEAST(power(GREATEST(0.0, d.dist / 1000.0 - q.plato_km) / q.escala_km, 2), 700.0))
            ) AS combinacao,
            (floor(1.0 / q.faixa_casamento) * 4 + 3) AS teto
          FROM dedup d, q
        )
        SELECT nome, tipo, municipio, estado, longitude, latitude,
          ((faixa * 4 + tier * 2 + combinacao + sim * 0.001) / (teto + 0.001)) AS score
        FROM pontuado
        ORDER BY score DESC
        LIMIT 5
      `, [q, centerLat, centerLon, zoom]);
      });

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
