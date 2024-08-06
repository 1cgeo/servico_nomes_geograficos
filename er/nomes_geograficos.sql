CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS ng;

CREATE TABLE ng.nomes_geograficos (
	id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    geom GEOMETRY(POINT, 4674) NOT NULL,
	CONSTRAINT nomes_geograficos_pk PRIMARY KEY (id)
);

CREATE INDEX idx_geographic_features_geometry ON ng.nomes_geograficos USING GIST (geom);
CREATE INDEX idx_geographic_features_name_trgm ON ng.nomes_geograficos USING GIN (nome gin_trgm_ops);
CREATE INDEX idx_geographic_features_type ON ng.nomes_geograficos (tipo);

GRANT ALL PRIVILEGES ON DATABASE nomes_geograficos TO user_nomes_geograficos;
GRANT ALL ON SCHEMA ng TO user_nomes_geograficos;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ng TO user_nomes_geograficos;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ng TO user_nomes_geograficos;