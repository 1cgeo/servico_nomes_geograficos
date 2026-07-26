# Critério de Busca — Nomes Geográficos

> **Revisado em 2026-07-26.** Este documento descrevia uma soma ponderada de seis
> critérios. A ordenação foi trocada por **três chaves lexicográficas** e os pesos não
> existem mais. A troca foi medida contra um conjunto dourado de 584 casos em 13
> famílias: aprovação de 81,5% para 92,6%.

## Parâmetros de entrada

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `q` | Sim | Texto de busca (3 a 200 caracteres) |
| `lat` | Sim | Latitude do centro do mapa |
| `lon` | Sim | Longitude do centro do mapa |
| `zoom` | Não | Nível de zoom do mapa (1 a 20) |

## A doutrina

**Vence a feição de maior importância mais próxima do local, com a importância sendo
CATEGÓRICA e não de entidade.** Cidade é muito importante e vem primeiro independente da
distância; não existe ranking entre cidades. Abaixo desse degrau vale a combinação de
proximidade e importância.

É a tríade que o Google documenta para resultado local: relevância, distância e
proeminência.

## Etapas do processo

### 1. Pré-filtragem de candidatos

O texto de busca e os nomes do banco são normalizados removendo acentos. Apenas
registros com similaridade textual (trigrama) acima de **0.25** passam adiante, e no
máximo **500 candidatos** são mantidos, ordenados por similaridade e distância.

O corte usa o **operador** `%` do `pg_trgm`, não a chamada `similarity(...) > 0.25`:
função é opaca ao planner e força varredura sequencial da tabela inteira. O limiar de
0.25 é preservado por `SET LOCAL pg_trgm.similarity_threshold = 0.25` na transação,
porque o default da extensão é 0.3 — os dois andam juntos, e remover o `SET LOCAL`
aperta a busca em silêncio.

Este corte importa mais que a pontuação: um termo genérico ("rio", "santa") queima as
500 vagas em quase-duplicatas e chega ao fim com poucas linhas distintas.

### 2. Deduplicação por cluster

Nomes que representam a mesma entidade do mundo real (mesmo nome, tipo e cluster
espacial de ~5 km) são agrupados, e só o registro mais próximo do ponto de busca
sobrevive por grupo.

### 3. Ordenação em três chaves

Comparadas em ordem: só se houver empate na primeira é que a segunda decide.

#### Chave 1 — Relevância, em faixa de largura 0.15

A qualidade do casamento é agrupada em faixas. Dentro da mesma faixa, a relevância deixa
de discriminar e a chave seguinte assume.

**Containment conta como casamento pleno.** Se o nome contém o texto buscado, a
qualidade é 1.0, independentemente da diferença de comprimento. Digitar "Altamira" com o
mapa em cima de "Altamira do Paraná" é um prefixo legítimo, não um erro de digitação;
mas o trigrama pune o comprimento (1,00 contra ~0,53) e jogaria os dois em faixas
diferentes, onde a categoria nunca chegaria a votar. Só essa regra levou a família de
colisão de substring de 14% para 77% de acerto.

#### Chave 2 — Categoria

`tipo_peso >= 1.0`, ou seja, **Cidade**, vem primeiro. Independente da distância.

Este degrau é a razão de a ordenação não ser uma soma. Numa soma — e também num produto —
distância suficiente sempre **compra** a diferença de categoria, porque as duas moram na
mesma unidade. Não existe peso que torne "cidade" incomparável: só torna caro. Uma chave
lexicográfica não se compra.

O caso que decidiu: uma Cidade do mesmo nome consultada a ~330 km, que deve aparecer no
topo. Soma de 7 critérios: 85,7%. A mesma soma recalibrada por otimizador: 85,7%. Produto
multiplicativo com decaimento gaussiano (o padrão do Elasticsearch): 47,6%. Três chaves:
**100%**.

Baixar o degrau para 0.9, incluindo Vila e Povoado, mede 90,6% no agregado, pior que os
92,6%.

#### Chave 3 — Combinação de importância e proximidade

`importância^0.3 × decaimento_gaussiano(distância)`, com **platô**: dentro de 10 km a
distância não penaliza nada e quem decide é a importância. O decaimento vale exatamente
0.5 quando a distância excedente iguala a escala (300 km).

O expoente 0.3 comprime a importância e não é enfeite: com expoente 1, multiplicar por
`tipo_peso = 0.1` divide por dez quem está no piso, e a família de feições no piso
desabava de 92% para 43% de acerto.

#### Chave 4 — Desempate por trigrama cru

Não melhora ranking nenhum (medido: zero efeito). Existe por **determinismo**: sem uma
última chave, candidatos idênticos nas três primeiras ordenam pelo que o plano do banco
devolver, e o plano muda com o volume de dados.

### 4. Resultado

Os **5** primeiros são retornados, como um array nu.

O campo `score` continua saindo e continua em [0,1]. Como a ordem é lexicográfica e não
um escalar, o `score` é a tupla codificada numa base que preserva a ordem (a faixa domina
a categoria, que domina a combinação), de modo que `ORDER BY score DESC` **é** a ordem das
chaves. Quem consome lê um número decrescente, como antes.

## Influência do zoom

Quando `zoom` é informado, ele afia **só o espaço**: o platô e a escala do decaimento
encolhem com `2^(10 - zoom)`, partindo de 10 km e 300 km no zoom 10.

| Zoom | Platô | Escala | Comportamento |
|------|-------|--------|---------------|
| 4 (país) | 640 km | 19.200 km | Distância praticamente não diferencia |
| 10 (região) | 10 km | 300 km | Padrão |
| 16 (bairro) | 156 m | 4,7 km | Só o que está muito perto sobrevive |

A **compressão da importância do tipo** por zoom, que este documento descrevia, foi
**removida**. Ela neutralizava `tipo_peso` em zoom alto (todo tipo virava 0.5), o que
contradiz a chave 2 frontalmente: zerar a diferença de categoria é exatamente o que a
doutrina proíbe.

> **Armadilha.** O PostgreSQL **lança erro** em underflow de float em vez de saturar em
> zero. Com zoom 16 a escala cai para ~4,7 km, um candidato a 300 km dá expoente 4096, e
> `power(0.5, 4096)` derrubava a requisição inteira com `22003 float_underflow_error`.
> Daí o `LEAST(..., 700)` no expoente. Só aparece com zoom alto **e** candidato distante
> ao mesmo tempo.

## Pré-requisito de dado

O ranking pressupõe o acervo corrigido por `dev/atualizar-acervo.sql`: deduplicado,
`tipo_peso` derivado por casamento de **palavra** (e não por igualdade contra uma lista
sem acento) e clusters recomputados. Sem a correção, 38% das linhas ficam no piso de
importância e a chave de categoria vale pouco. Ver `dev/README.md`.
