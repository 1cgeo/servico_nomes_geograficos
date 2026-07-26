-- dev/atualizar-acervo.sql
--
-- Traz o acervo do EBGeo antigo para o padrao de busca novo. Roda numa transacao so:
-- ou tudo entra, ou nada. MUTA DADO (apaga duplicatas) — faca backup antes.
--
--   pg_dump -U postgres -d nomes_geograficos -n ng -f backup_antes.sql
--   psql -U postgres -d nomes_geograficos -f dev/diagnostico.sql          # o antes
--   psql -U postgres -d nomes_geograficos -v ON_ERROR_STOP=1 -f dev/atualizar-acervo.sql
--   psql -U postgres -d nomes_geograficos -f dev/diagnostico.sql          # o depois
--
-- Idempotente: rodar duas vezes nao muda nada na segunda.
--
-- Sao QUATRO correcoes, todas medidas contra o acervo real de 2026-07-23:
--   1. tipo_peso passa a casar PALAVRA em vez de substring
--   2. duplicatas exatas removidas (36% do acervo)
--   3. tipo_peso re-derivado em todas as linhas
--   4. clusters recomputados (e a funcao refresh_busca criada, para o proximo carregamento)

BEGIN;

-- ============================================================================
-- 1. tipo_peso: casamento por PALAVRA, nao por substring
-- ============================================================================
-- O CASE antigo comparava o tipo por IGUALDADE contra uma lista escrita SEM acento
-- ('Represa/acude com fluxo', 'Aglomerado rural isolado - Povoado' com hifen ASCII),
-- enquanto o vocabulario real e acentuado e usa travessao. Resultado medido: 38% do
-- acervo caia no piso 0.1, incluindo 3.087 povoados, 999 lagos e 796 represas.
--
-- O outro lado do mesmo defeito: onde havia LIKE '%rio%', substring nao respeita
-- fronteira de palavra e "rio" aparece dentro de cemiteRIO, aviaRIO, aterro sanitaRIO,
-- supeRIOr, reservatoRIO, patio rodoviaRIO e ferroviaRIO. Foram 658 linhas ranqueadas
-- como HIDROGRAFIA (o terceiro maior peso) sem ser. Aparecia no produto: o top-5 de
-- "brasilia" trazia "Granja Progresso de Brasilia | Agro - Aviario" com peso de rio.
-- E o ramo errado disparava ANTES do ramo certo, entao tambem roubava o peso correto.
--
-- A ASSINATURA e o nome NAO mudam, de proposito: o trigger
-- ng.nomes_geograficos_set_tipo_peso() chama esta funcao e continua funcionando sem
-- ser tocado.
--
-- ARMADILHA SIMETRICA, que quase entrou junto: 'com' como abreviacao de comercio casa
-- a preposicao de '(com fluxo)', que o vocabulario usa as pencas, e transformaria
-- "Laguna (com fluxo)" em comercio (50 linhas). Por isso o ramo lista so
-- 'comercio|comerc'. Antes de acrescentar abreviacao nova aqui, rode o diagnostico:
-- NADA nesta funcao falha alto, o erro so aparece como ordem estranha no dropdown.
CREATE OR REPLACE FUNCTION ng.calcular_tipo_peso(p_tipo character varying)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE t TEXT := ng.f_unaccent(lower(COALESCE(p_tipo, '')));
BEGIN
  RETURN CASE
    WHEN t ~ '\mcidades?\M'                                                THEN 1.0
    WHEN t ~ '\m(vilas?|povoados?|lugarejos?|nucleos?)\M'                  THEN 0.9
    WHEN t ~ '\m(rios?|lagos?|lagoas?|represas?|acudes?)\M'                THEN 0.85
    WHEN t ~ '\m(serras?|morros?|ilhas?|picos?|pontas?|praias?)\M'         THEN 0.8
    WHEN t ~ '\mnome local\M'                                              THEN 0.75
    WHEN t ~ '\m(estradas?|rodovias?)\M'                                   THEN 0.7
    WHEN t ~ '\m(arroios?|canal|canais|cachoeiras?|corredeiras?|foz)\M'    THEN 0.6
    WHEN t ~ '\m(unidade de conservacao|terras? indigenas?)\M'             THEN 0.55
    WHEN t ~ '\magro\M'                                                    THEN 0.5
    WHEN t ~ '\m(pontes?|portos?|rodoviarias?|aeroportos?)\M'              THEN 0.4
    WHEN t ~ '\m(saude|sau|ensino|ens|seguranca|seg|administra\w*)\M'      THEN 0.35
    WHEN t ~ '\m(energia|eletrica|eolica|solar|subestacao|termeletrica|hidreletrica)\M' THEN 0.3
    WHEN t ~ '\m(comercio|comerc|industria|ind|lazer)\M'                   THEN 0.25
    WHEN t ~ '\m(saneamento|saneam|sanitario|san|comunicacao|comunic|dutos?)\M' THEN 0.2
    WHEN t ~ '\m(religios\w*|rel|cemiterios?)\M'                           THEN 0.15
    ELSE 0.1
  END;
END;
$$;

-- ============================================================================
-- 2. Duplicatas exatas
-- ============================================================================
-- 29.544 de 81.964 linhas (36%) sao identicas em (nome, tipo, municipio, estado,
-- coordenada). A desduplicacao da busca (DISTINCT ON por cluster) as absorve na
-- resposta, entao elas nunca apareceram para o usuario; o custo e indice e varredura,
-- e o orcamento de 500 candidatos gasto em copias.
--
-- A chave inclui a COORDENADA, entao isto so colapsa linhas no MESMO ponto: duas
-- ocorrencias distintas do mesmo nome no mesmo municipio continuam duas linhas. Isso
-- foi verificado comparando o acervo completo com o deduplicado, ambos com clusters
-- recomputados: 0 localidades perdidas, 0 inventadas, e a ESTRUTURA de clusters
-- (o conjunto de grupos {nome, tipo, pontos}) identica.
--
-- O que muda e a NUMERACAO dos clusters, porque ST_ClusterDBSCAN numera por ordem de
-- linha. Nao e efeito da dedup e sim de qualquer mudanca no conjunto de linhas.
-- cluster_id e ROTULO, nao identidade: nada fora do schema ng o persiste.
WITH ranqueado AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY nome, tipo, municipio, estado, ST_X(geom), ST_Y(geom)
           ORDER BY id
         ) AS rn
  FROM ng.nomes_geograficos
)
DELETE FROM ng.nomes_geograficos n
USING ranqueado r
WHERE n.id = r.id AND r.rn > 1;

-- ============================================================================
-- 3 e 4. Re-derivar tipo_peso e recomputar clusters
-- ============================================================================
-- Trocar a funcao NAO reclassifica quem ja esta gravado: tipo_peso e coluna, nao
-- expressao. E cluster_id nao tem trigger nenhum — recomputar_clusters e a unica
-- fonte dele. Esquecer qualquer um dos dois nao gera erro: degrada em silencio.
--
-- refresh_busca() existe para que o passo pos-carga seja UMA chamada, igual a do
-- backend novo, e para que ninguem precise lembrar dos dois separadamente.
CREATE OR REPLACE FUNCTION ng.refresh_busca() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ng.nomes_geograficos SET tipo = tipo;  -- re-dispara o trigger de tipo_peso
  PERFORM ng.recomputar_clusters();
END;
$$;

SELECT ng.refresh_busca();

ANALYZE ng.nomes_geograficos;

COMMIT;

\echo ''
\echo '=== Verificacao imediata (o diagnostico completo mede o resto) ==='
SELECT count(*) AS linhas,
       count(*) FILTER (WHERE cluster_id IS NULL) AS sem_cluster,
       count(*) FILTER (WHERE tipo_peso IS DISTINCT FROM ng.calcular_tipo_peso(tipo)) AS peso_divergente,
       count(*) FILTER (WHERE tipo_peso = 0.85
                          AND ng.f_unaccent(lower(tipo)) !~ '\m(rios?|lagos?|lagoas?|represas?|acudes?)\M')
         AS falsos_hidrografia
FROM ng.nomes_geograficos;
