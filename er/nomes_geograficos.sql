CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS ng;

CREATE TABLE ng.nomes_geograficos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255)
    geom GEOMETRY(POINT, 4674) NOT NULL,
);

CREATE INDEX idx_geographic_features_geometry ON ng.nomes_geograficos USING GIST (geom);
CREATE INDEX idx_geographic_features_name_trgm ON ng.nomes_geograficos USING GIN (nome gin_trgm_ops);
CREATE INDEX idx_geographic_features_type ON ng.nomes_geograficos (tipo);

GRANT ALL PRIVILEGES ON DATABASE geographic_search TO user_nomes_geograficos;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO user_nomes_geograficos;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO user_nomes_geograficos;