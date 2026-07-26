# dev/

Manutenção do acervo, rodada à mão contra o banco. Não faz parte de nenhum build e não
tem dependência nova: é `psql` puro.

Estes scripts trazem o acervo do EBGeo antigo para o **mesmo padrão de busca** do backend
novo (`ebgeo_web/backend`). O `src/index.js` deste serviço já foi atualizado para o
ranking novo, e **ele pressupõe o acervo corrigido**: sem a correção, a chave de
categoria vale pouco, porque 38% das linhas ficam no piso de importância.

## Ordem

```bash
# 0. backup. A dedup APAGA linha.
pg_dump -U postgres -d nomes_geograficos -n ng -f backup_antes.sql

# 1. o "antes"
psql -U postgres -d nomes_geograficos -f dev/diagnostico.sql

# 2. a correção (transacional, idempotente)
psql -U postgres -d nomes_geograficos -v ON_ERROR_STOP=1 -f dev/atualizar-acervo.sql

# 3. o "depois" — é a DIFERENÇA entre 1 e 3 que vale, não o "concluído" do passo 2
psql -U postgres -d nomes_geograficos -f dev/diagnostico.sql
```

## O que a correção faz, e o que cada coisa custava

Medido no acervo de 2026-07-23 (81.964 topônimos):

| | antes | depois |
|---|---|---|
| linhas | 81.964 | 52.420 |
| duplicatas exatas | 29.544 (36%) | 0 |
| `tipo_peso` divergente do derivado | 2.016 | 0 |
| no piso 0.1 | 31.198 (38,1%) | 11.821 (22,6%) |
| sem `cluster_id` | 21.703 | 0 |

**1. `tipo_peso` passa a casar palavra.** O `CASE` antigo comparava o tipo por igualdade
contra uma lista escrita **sem acento** (`'Represa/acude com fluxo'`, `'Aglomerado rural
isolado - Povoado'` com hífen ASCII), enquanto o vocabulário real é acentuado e usa
travessão. Por isso 38% do acervo caía no piso, incluindo 3.087 povoados, 999 lagos e
796 represas. A assinatura da função não muda, então o trigger existente continua
funcionando sem ser tocado.

**2. Duplicatas exatas removidas.** A chave inclui a coordenada, então só colapsa linhas
no mesmo ponto: duas ocorrências distintas do mesmo nome no mesmo município continuam
duas linhas. Verificado comparando acervo completo e deduplicado, ambos com clusters
recomputados: 0 localidades perdidas, 0 inventadas, e a estrutura de clusters idêntica.
O que muda é a **numeração** dos clusters, porque `ST_ClusterDBSCAN` numera por ordem de
linha; `cluster_id` é rótulo, não identidade, e nada fora do schema `ng` o persiste.

**3. `tipo_peso` re-derivado e clusters recomputados.** Trocar a função não reclassifica
quem já está gravado (`tipo_peso` é coluna, não expressão), e `cluster_id` não tem
trigger nenhum. Esquecer qualquer um dos dois não gera erro: **degrada em silêncio**.
Por isso a correção termina criando `ng.refresh_busca()`, que faz os dois numa chamada.

## Depois de toda carga nova (FME)

```sql
SELECT ng.refresh_busca();
```

Não é opcional e não avisa quando falta. `cluster_id` fica nulo, a desduplicação da
busca para de funcionar e o mesmo lugar passa a ocupar várias das cinco vagas do
resultado.

## A armadilha que quase entrou junto

Ao reescrever a hierarquia de tipos, `com` como abreviação de "comércio" parece natural
(o vocabulário usa `Comerc -`, `San -`, `Ens -`, `Rel -`). Mas `com` é preposição, e o
vocabulário está cheio de `(com fluxo)`: a abreviação transformaria `Laguna (com fluxo)`
em comércio, 50 linhas. Por isso o ramo lista só `comercio|comerc`.

Antes de acrescentar abreviação nova, rode o diagnóstico contra o acervo. **Nada nessa
função falha alto**: o erro só aparece como ordem estranha no dropdown do usuário.
