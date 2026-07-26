# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Geographic names service (Serviço de Nomes Geográficos) for the Brazilian Army (1ºCGEO/DSG). A Node.js/Express REST API backed by PostgreSQL/PostGIS that provides geographic name search, building feature lookup, and 3D catalog browsing.

## Commands

```bash
npm start          # Run the server (node src/index.js)
```

No build step, test suite, linting, or dev server is configured.

## Environment Variables

Required: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
Optional: `PORT` (defaults to 3000)

## Architecture

**Single-file Express API** (`src/index.js`) using Node.js `cluster` module to spawn multiple worker processes (up to `min(floor(CPUs/3), 8)`).

**Database**: PostgreSQL with PostGIS, pg_trgm, and unaccent extensions. Schema lives in `ng` namespace with three tables:
- `ng.nomes_geograficos` — geographic names with POINT geometries (SRID 4674). Has pre-computed `cluster_id` (ST_ClusterDBSCAN by nome+tipo, ~5km) and `tipo_peso` (type importance 0.1–1.0). Uses `ng.f_unaccent()` immutable wrapper for indexed accent-insensitive trigram search.
- `ng.edificacoes` — building footprints with POLYGON geometries (SRID 4326) and altitude range
- `ng.catalogo_3d` — 3D model catalog with Portuguese full-text search via `tsvector`

**API Endpoints**:
- `GET /busca` — search geographic names by text query + lat/lon. Ranking: **three lexicographic keys**, not a weighted sum (see below). Deduplicates by cluster_id so the same real-world entity appears only once.
- `GET /feicoes` — find closest building at a given lat/lon/z coordinate (3m buffer)
- `GET /catalogo3d` — paginated 3D catalog search with full-text ranking

**Database schema SQL**: `er/nomes_geograficos.sql` (includes table definitions, indexes, triggers)
**Migration for search v2**: `er/migration_busca_v2.sql` (adds cluster_id, tipo_peso, unaccent index)
**Test data**: `er/insert_teste.sql`
**ETL pipelines**: FME Workbench files (`er/*.fmw`) for data conversion
**Manutenção do acervo**: `dev/` (diagnóstico + correção). Ver `dev/README.md`.

## Ranking de `/busca` (2026-07-26)

Era uma soma ponderada de critérios. Hoje é uma ordenação em **três chaves
lexicográficas**, medida contra um conjunto dourado de 584 casos (aprovação 81,5% →
92,6%). A doutrina: **vence a feição de maior importância mais próxima do local, com a
importância sendo CATEGÓRICA** — cidade é muito importante e vem primeiro independente da
distância, e não existe ranking entre cidades.

As chaves: relevância em faixa (com *containment* valendo casamento pleno) → categoria
(`tipo_peso >= 1.0`) → combinação de importância e proximidade (gaussiana com platô de
10 km) → desempate por trigrama.

**Por que não é soma**: numa soma, distância suficiente sempre *compra* a diferença de
categoria, porque as duas moram na mesma unidade. Uma chave lexicográfica não se compra.

O campo `score` continua saindo em [0,1]: é a tupla codificada numa base que preserva a
ordem, então `ORDER BY score DESC` é a ordem das chaves. O racional completo está no
comentário acima da rota em `src/index.js`, e a documentação longa (com as medições e o
método de calibração) vive no repositório do EBGeo novo, em
`docs/wiki/ranking-busca-toponimos.md` e `docs/wiki/calibracao-busca-toponimos.md`.

**Este ranking pressupõe o acervo corrigido por `dev/atualizar-acervo.sql`.** Sem a
correção, 38% das linhas ficam no piso de importância e a chave de categoria vale pouco.

## Key Dependencies

- `pg-promise` for PostgreSQL access (connection pool: max 10, idle timeout 30s)
- `express-validator` for request validation
- `cors` enabled globally
- Request logging to `api-access.log`
