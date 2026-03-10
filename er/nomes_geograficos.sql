CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS ng;

-- Função imutável para uso em índices (unaccent padrão é STABLE)
CREATE OR REPLACE FUNCTION ng.f_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- ============================================================
-- Tabela: nomes_geograficos
-- ============================================================

CREATE TABLE ng.nomes_geograficos (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    cluster_id INTEGER,
    tipo_peso FLOAT DEFAULT 0.1,
    geom GEOMETRY(POINT, 4674) NOT NULL,
    CONSTRAINT nomes_geograficos_pk PRIMARY KEY (id)
);

CREATE INDEX idx_ng_geom ON ng.nomes_geograficos USING GIST (geom);
CREATE INDEX idx_ng_nome_unaccent_trgm ON ng.nomes_geograficos USING GIN (ng.f_unaccent(nome) gin_trgm_ops);
CREATE INDEX idx_ng_tipo ON ng.nomes_geograficos (tipo);
CREATE INDEX idx_ng_cluster ON ng.nomes_geograficos (nome, tipo, cluster_id);
CREATE INDEX idx_ng_tipo_peso ON ng.nomes_geograficos (tipo_peso DESC);

-- Função: calcula tipo_peso a partir do tipo
CREATE OR REPLACE FUNCTION ng.calcular_tipo_peso(p_tipo VARCHAR)
RETURNS FLOAT AS $$
BEGIN
  RETURN CASE
    WHEN p_tipo = 'Cidade' THEN 1.0

    WHEN p_tipo IN (
      'Vila',
      'Aglomerado rural isolado - Povoado',
      'Aglomerado rural isolado - Nucleo',
      'Aglomerado rural isolado - Lugarejo'
    ) THEN 0.9

    WHEN p_tipo IN (
      'Rio','Rio (com fluxo)',
      'Lago/Lagoa natural',
      'Represa/acude com fluxo','Represa/acude sem fluxo'
    ) THEN 0.85

    WHEN p_tipo IN (
      'Serra','Morro','Ilha','Fluvial','Maritima',
      'Peninsula','Pico','Ponta','Praia'
    ) THEN 0.8

    WHEN p_tipo = 'Nome local' THEN 0.75

    WHEN p_tipo IN ('Estrada/Rodovia','Auto-estrada') THEN 0.7

    WHEN p_tipo IN (
      'Arroio','Canal','Canal (com fluxo)',
      'Cachoeira','Foz maritima','Corredeira'
    ) THEN 0.6

    WHEN p_tipo LIKE 'Unidade de conservacao%' OR p_tipo = 'Terra indigena' THEN 0.55

    WHEN p_tipo LIKE 'Agro -%' THEN 0.5

    WHEN p_tipo IN ('Ponte fixa','Porto')
      OR p_tipo LIKE 'Rod -%' OR p_tipo LIKE 'Aero -%' THEN 0.4

    WHEN p_tipo LIKE 'Saude -%' OR p_tipo LIKE 'Ens -%'
      OR p_tipo LIKE 'Seg -%' OR p_tipo LIKE 'Adm -%' THEN 0.35

    WHEN p_tipo LIKE '%eletrica%' OR p_tipo LIKE '%Eolica%' OR p_tipo LIKE '%Solar%'
      OR p_tipo LIKE 'Subestacao%' OR p_tipo LIKE 'Linha de transmissao%' THEN 0.3

    WHEN p_tipo LIKE 'Com -%' OR p_tipo LIKE 'Ind -%' OR p_tipo LIKE 'Lazer -%' THEN 0.25

    WHEN p_tipo LIKE 'San -%' OR p_tipo LIKE 'Saneam -%'
      OR p_tipo LIKE 'Comunic -%' OR p_tipo LIKE 'Duto%' THEN 0.2

    WHEN p_tipo LIKE 'Rel -%' OR p_tipo LIKE 'Cemiterio%' THEN 0.15

    ELSE 0.1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: preenche tipo_peso automaticamente ao inserir/atualizar
CREATE OR REPLACE FUNCTION ng.nomes_geograficos_set_tipo_peso()
RETURNS trigger AS $$
BEGIN
  NEW.tipo_peso := ng.calcular_tipo_peso(NEW.tipo);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nomes_geograficos_tipo_peso
BEFORE INSERT OR UPDATE OF tipo ON ng.nomes_geograficos
FOR EACH ROW EXECUTE FUNCTION ng.nomes_geograficos_set_tipo_peso();

-- Função utilitária: recomputa cluster_id para toda a tabela
-- Executar após carga de dados: SELECT ng.recomputar_clusters();
CREATE OR REPLACE FUNCTION ng.recomputar_clusters()
RETURNS void AS $$
BEGIN
  WITH clusters AS (
    SELECT id,
      ST_ClusterDBSCAN(geom, eps := 0.045, minpoints := 1)
        OVER (PARTITION BY nome, tipo) AS cid
    FROM ng.nomes_geograficos
  )
  UPDATE ng.nomes_geograficos n
  SET cluster_id = c.cid
  FROM clusters c WHERE n.id = c.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Tabela: edificacoes
-- ============================================================

CREATE TABLE ng.edificacoes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255),
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    altitude_base numeric,
    altitude_topo numeric,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    CONSTRAINT edificacoes_pk PRIMARY KEY (id),
    CONSTRAINT chk_altitude_base_topo CHECK (altitude_base <= altitude_topo)
);

CREATE INDEX idx_edificacoes_geometry ON ng.edificacoes USING GIST (geom);
CREATE INDEX idx_edificacoes_altitude ON ng.edificacoes (altitude_base, altitude_topo);

-- ============================================================
-- Tabela: catalogo_3d
-- ============================================================

CREATE TABLE ng.catalogo_3d (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    thumbnail VARCHAR(255),
    palavras_chave TEXT[],
    url VARCHAR(255) NOT NULL,
    lon NUMERIC,
    lat NUMERIC,
    height NUMERIC,
    heading NUMERIC,
    pitch NUMERIC,
    roll NUMERIC,
    type VARCHAR(50) NOT NULL,
    heightoffset NUMERIC,
    maximumscreenspaceerror NUMERIC,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector,
    style JSONB,
    CONSTRAINT catalogo_3d_pk PRIMARY KEY (id)
);

CREATE INDEX idx_catalogo_3d_data_criacao ON ng.catalogo_3d (data_criacao DESC);
CREATE INDEX idx_catalogo_3d_search_vector ON ng.catalogo_3d USING GIN (search_vector);
CREATE INDEX idx_catalogo_3d_type ON ng.catalogo_3d (type);

CREATE OR REPLACE FUNCTION ng.catalogo_3d_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.municipio, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.estado, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.palavras_chave, ' '), '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalogo_3d_search_vector_update
BEFORE INSERT OR UPDATE ON ng.catalogo_3d
FOR EACH ROW EXECUTE FUNCTION ng.catalogo_3d_search_vector_update();

-- ============================================================
-- Permissões
-- ============================================================

GRANT ALL PRIVILEGES ON DATABASE nomes_geograficos TO user_nomes_geograficos;
GRANT ALL ON SCHEMA ng TO user_nomes_geograficos;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ng TO user_nomes_geograficos;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ng TO user_nomes_geograficos;
