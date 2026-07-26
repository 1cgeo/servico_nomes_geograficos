-- dev/diagnostico.sql
--
-- SOMENTE LEITURA. Mede, no acervo atual, os tres defeitos que o
-- dev/atualizar-acervo.sql conserta. Rode isto ANTES e DEPOIS: o valor de um script
-- de manutencao esta na diferenca entre as duas saidas, nao no "concluido" dele.
--
--   psql -U postgres -h localhost -d nomes_geograficos -f dev/diagnostico.sql
--
-- Numeros de referencia, medidos no backup de 2026-07-23 (81.964 toponimos):
--   duplicatas exatas ......... 29.544 (36% do acervo)
--   peso divergente ............ 2.016
--   no piso 0.1 ............... 31.198 (38%), sendo 336 tipos distintos
--   sem cluster_id ............ 21.703

\echo ''
\echo '=== 1. Duplicatas exatas (nome, tipo, municipio, estado, coordenada) ==='
SELECT count(*) AS total,
       count(*) - count(DISTINCT (nome, tipo, municipio, estado, ST_X(geom), ST_Y(geom))) AS duplicatas,
       round(100.0 * (count(*) - count(DISTINCT (nome, tipo, municipio, estado, ST_X(geom), ST_Y(geom))))
             / NULLIF(count(*), 0), 1) AS pct
FROM ng.nomes_geograficos;

\echo ''
\echo '=== 2. tipo_peso GRAVADO divergente do que a funcao devolveria ==='
\echo '(valor obsoleto: linha inserida antes de a funcao mudar, ou por caminho que'
\echo ' desabilitou o trigger. E derivado, nao deveria divergir nunca.)'
SELECT count(*) AS divergentes
FROM ng.nomes_geograficos
WHERE tipo_peso IS DISTINCT FROM ng.calcular_tipo_peso(tipo);

\echo ''
\echo '=== 3. Quanto do acervo esta no piso 0.1 (o balde indiferenciado) ==='
SELECT count(*) FILTER (WHERE tipo_peso = 0.1) AS no_piso,
       count(DISTINCT tipo) FILTER (WHERE tipo_peso = 0.1) AS tipos_no_piso,
       round(100.0 * count(*) FILTER (WHERE tipo_peso = 0.1) / NULLIF(count(*), 0), 1) AS pct
FROM ng.nomes_geograficos;

\echo ''
\echo '=== 3b. Os maiores tipos que caem no piso (devem ser POUCOS depois da correcao) ==='
SELECT tipo, count(*) AS n
FROM ng.nomes_geograficos
WHERE tipo_peso = 0.1 AND tipo IS NOT NULL AND tipo <> ''
GROUP BY 1 ORDER BY 2 DESC LIMIT 12;

\echo ''
\echo '=== 4. cluster_id ausente (a busca dedupica por ele; nulo = degrada calado) ==='
SELECT count(*) FILTER (WHERE cluster_id IS NULL) AS sem_cluster,
       count(DISTINCT cluster_id) AS clusters
FROM ng.nomes_geograficos;

\echo ''
\echo '=== 5. POS-CONDICAO: falsos positivos de hidrografia ==='
\echo '(Nao e defeito do acervo antigo: a funcao antiga comparava tipo por IGUALDADE e'
\echo ' por isso da ZERO aqui antes da correcao. Esta checagem guarda a funcao NOVA, que'
\echo ' casa por palavra. Se alguem trocar \m..\M por LIKE por substring, "rio" volta a'
\echo ' aparecer dentro de cemiteRIO, aviaRIO, aterro sanitaRIO e supeRIOr, e sao 658'
\echo ' linhas ranqueadas como hidrografia sem ser. Tem de continuar ZERO.)'
SELECT tipo, tipo_peso, count(*) AS n
FROM ng.nomes_geograficos
WHERE tipo_peso = 0.85
  AND ng.f_unaccent(lower(tipo)) !~ '\m(rios?|lagos?|lagoas?|represas?|acudes?)\M'
GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15;
