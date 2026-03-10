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
- `GET /busca` — search geographic names by text query + lat/lon. Ranking: exact match (30%) + trigram similarity (25%) + name precision (25%) + type importance (10%) + proximity (10%). Deduplicates by cluster_id so the same real-world entity appears only once.
- `GET /feicoes` — find closest building at a given lat/lon/z coordinate (3m buffer)
- `GET /catalogo3d` — paginated 3D catalog search with full-text ranking

**Database schema SQL**: `er/nomes_geograficos.sql` (includes table definitions, indexes, triggers)
**Migration for search v2**: `er/migration_busca_v2.sql` (adds cluster_id, tipo_peso, unaccent index)
**Test data**: `er/insert_teste.sql`
**ETL pipelines**: FME Workbench files (`er/*.fmw`) for data conversion

## Key Dependencies

- `pg-promise` for PostgreSQL access (connection pool: max 10, idle timeout 30s)
- `express-validator` for request validation
- `cors` enabled globally
- Request logging to `api-access.log`
