# Critério de Busca — Nomes Geográficos

## Parâmetros de entrada

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `q` | Sim | Texto de busca (3 a 200 caracteres) |
| `lat` | Sim | Latitude do centro do mapa |
| `lon` | Sim | Longitude do centro do mapa |
| `zoom` | Não | Nível de zoom do mapa (1 a 20) |

## Etapas do processo

### 1. Pré-filtragem de candidatos

O texto de busca e os nomes do banco são normalizados removendo acentos. Apenas registros com similaridade textual (trigrama) acima de **0.25** passam para a etapa seguinte. São mantidos no máximo **500 candidatos**, ordenados por similaridade e distância.

### 2. Deduplicação por cluster

Nomes geográficos que representam a mesma entidade do mundo real (mesmo nome, tipo e cluster espacial de ~5 km) são agrupados. Apenas o registro mais próximo do ponto de busca sobrevive por grupo.

### 3. Pontuação final

Cada candidato recebe uma pontuação de 0 a 1, composta por seis critérios com pesos fixos:

#### Correspondência exata (peso 0.20)

Vale 1.0 se o nome normalizado for exatamente igual ao texto buscado (ignorando maiúsculas/minúsculas), ou 0.0 caso contrário. Garante que um resultado idêntico ao digitado sempre tenha vantagem.

#### Correspondência por prefixo (peso 0.15)

Vale 1.0 se o nome normalizado começar com o texto buscado, ou 0.0 caso contrário. Favorece resultados cujo início coincide com o que o usuário digitou — por exemplo, buscar "Serra" favorece "Serra do Mar" sobre "Parque da Serra".

#### Similaridade textual (peso 0.20)

Valor entre 0 e 1 calculado pelo algoritmo de trigramas (pg_trgm). Mede o quanto as sequências de 3 caracteres do texto buscado e do nome se sobrepõem. Captura correspondências parciais e tolera pequenos erros de digitação.

#### Precisão do nome (peso 0.15)

Compara o comprimento do texto buscado com o comprimento do nome. Quanto mais próximos, maior a pontuação. Evita que nomes muito longos (que contêm o termo buscado junto de muitas outras palavras) pontuem igual a nomes curtos e diretos.

#### Importância do tipo geográfico (peso 0.10)

Cada tipo geográfico possui um peso pré-definido entre 0.1 e 1.0 (coluna `tipo_peso`). Capitais e grandes feições naturais têm peso alto; edificações e feições menores têm peso baixo. Esse critério dá preferência a resultados de maior relevância geográfica geral.

#### Proximidade geográfica (peso 0.20)

Usa uma função de decaimento: `1 / (1 + distância / distância_de_referência)`. Quanto mais perto do ponto lat/lon informado, maior a pontuação. A distância de referência padrão é **50 km** — resultados a 50 km recebem metade da pontuação máxima.

### 4. Resultado

Os **5** candidatos com maior pontuação final são retornados.

## Influência do zoom

Quando o parâmetro `zoom` é informado, dois dos critérios acima têm seus **valores ajustados** (os pesos permanecem fixos):

### Distância de referência adaptativa

A distância de referência do decaimento de proximidade varia com o zoom:

`distância_de_referência = 50 km × 2^(10 - zoom)`

| Zoom | Distância de referência | Comportamento |
|------|------------------------|---------------|
| 4 (país) | ~3.200 km | Proximidade pontua ~1.0 para quase tudo — praticamente não diferencia por distância |
| 10 (região) | 50 km | Comportamento padrão |
| 16 (bairro) | ~780 m | Apenas resultados muito próximos pontuam bem |

### Compressão da importância do tipo

Em zoom alto, a diferença entre tipos geográficos é progressivamente neutralizada:

`peso_ajustado = tipo_peso × (1 - fator_zoom) + 0.5 × fator_zoom`

O fator de zoom varia linearmente de 0 (zoom 4) a 1 (zoom 18+).

| Zoom | Fator | Cidade (1.0) | Escola (0.35) | Efeito |
|------|-------|-------------|--------------|--------|
| 4 | 0.0 | 1.0 | 0.35 | Diferenciação total entre tipos |
| 11 | 0.5 | 0.75 | 0.43 | Diferenciação parcial |
| 18 | 1.0 | 0.50 | 0.50 | Todos os tipos equivalentes |

### Comportamento resultante

- **Zoom baixo** (visão do país): a proximidade não diferencia e os tipos importam — cidades e rios grandes aparecem primeiro.
- **Zoom alto** (visão de bairro): a proximidade diferencia agressivamente e os tipos são neutralizados — o resultado mais perto vence, independente de ser uma escola ou uma capital.
- **Sem zoom**: comportamento idêntico ao padrão (distância de referência de 50 km, diferenciação total entre tipos).
