-- Migration: Melhoria da busca de nomes geográficos
-- Adiciona extensão unaccent, colunas cluster_id e tipo_peso, e índices otimizados

-- 1) Extensão para busca sem acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Função imutável para uso em índices (unaccent padrão é STABLE, não permite índice)
CREATE OR REPLACE FUNCTION ng.f_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 3) Novas colunas
ALTER TABLE ng.nomes_geograficos ADD COLUMN IF NOT EXISTS cluster_id INTEGER;
ALTER TABLE ng.nomes_geograficos ADD COLUMN IF NOT EXISTS tipo_peso FLOAT DEFAULT 0.1;

-- 4) Computar clusters espaciais: agrupa pontos com mesmo nome+tipo próximos (~5km)
WITH clusters AS (
  SELECT id,
    ST_ClusterDBSCAN(geom, eps := 0.045, minpoints := 1)
      OVER (PARTITION BY nome, tipo) AS cid
  FROM ng.nomes_geograficos
)
UPDATE ng.nomes_geograficos n
SET cluster_id = c.cid
FROM clusters c WHERE n.id = c.id;

-- 5) Preencher tipo_peso conforme hierarquia de importância
UPDATE ng.nomes_geograficos SET tipo_peso = CASE
  WHEN tipo = 'Cidade' THEN 1.0

  WHEN tipo IN (
    'Vila',
    'Aglomerado rural isolado - Povoado',
    'Aglomerado rural isolado - Nucleo',
    'Aglomerado rural isolado - Lugarejo'
  ) THEN 0.9

  WHEN tipo IN (
    'Rio','Rio (com fluxo)',
    'Lago/Lagoa natural',
    'Represa/acude com fluxo','Represa/acude sem fluxo'
  ) THEN 0.85

  WHEN tipo IN (
    'Serra','Morro','Ilha','Fluvial','Maritima',
    'Peninsula','Pico','Ponta','Praia'
  ) THEN 0.8

  WHEN tipo = 'Nome local' THEN 0.75

  WHEN tipo IN ('Estrada/Rodovia','Auto-estrada') THEN 0.7

  WHEN tipo IN (
    'Arroio','Canal','Canal (com fluxo)',
    'Cachoeira','Foz maritima','Corredeira'
  ) THEN 0.6

  WHEN tipo LIKE 'Unidade de conservacao%' OR tipo = 'Terra indigena' THEN 0.55

  WHEN tipo LIKE 'Agro -%' THEN 0.5

  WHEN tipo IN ('Ponte fixa','Porto')
    OR tipo LIKE 'Rod -%' OR tipo LIKE 'Aero -%' THEN 0.4

  WHEN tipo LIKE 'Saude -%' OR tipo LIKE 'Ens -%'
    OR tipo LIKE 'Seg -%' OR tipo LIKE 'Adm -%' THEN 0.35

  WHEN tipo LIKE '%eletrica%' OR tipo LIKE '%Eolica%' OR tipo LIKE '%Solar%'
    OR tipo LIKE 'Subestacao%' OR tipo LIKE 'Linha de transmissao%' THEN 0.3

  WHEN tipo LIKE 'Com -%' OR tipo LIKE 'Ind -%' OR tipo LIKE 'Lazer -%' THEN 0.25

  WHEN tipo LIKE 'San -%' OR tipo LIKE 'Saneam -%'
    OR tipo LIKE 'Comunic -%' OR tipo LIKE 'Duto%' THEN 0.2

  WHEN tipo LIKE 'Rel -%' OR tipo LIKE 'Cemiterio%' THEN 0.15

  WHEN tipo IS NULL THEN 0.1

  ELSE 0.1
END;

-- 6) Índices otimizados para a nova busca
DROP INDEX IF EXISTS ng.idx_geographic_features_name_trgm;

CREATE INDEX idx_ng_nome_unaccent_trgm
  ON ng.nomes_geograficos
  USING GIN (ng.f_unaccent(nome) gin_trgm_ops);

CREATE INDEX idx_ng_cluster
  ON ng.nomes_geograficos (nome, tipo, cluster_id);

CREATE INDEX idx_ng_tipo_peso
  ON ng.nomes_geograficos (tipo_peso DESC);
