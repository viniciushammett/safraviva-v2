# Logística Colaborativa — Sprint 4A

## Escopo e contratos

A página Logística atende à organização produtora ativa, com Entregas Pendentes, Oportunidades de Consolidação, Transportes em Andamento, parceiros cadastrados e mapa opcional. Reutiliza Dialog, StatusBadge, formulários React Hook Form/Zod, `useDomainQuery`, o store de revisão e a unidade de trabalho existente.

`Order.delivery` é opcional e contém origem e destino explicitamente informados (local, município, UF e coordenadas opcionais), janela de entrega em datas ISO, peso, restrições e distância de referência. Não altera quantidade ou valores financeiros. Não se deduz destino da sede do comprador. Peso deve coincidir com a quantidade do pedido, pois esta sprint não divide um pedido em entregas parciais.

Cada coordenada tem fonte `synthetic` ou `provided_reference`: nenhuma é localização verificada ou GPS. Distância de referência é informada manualmente, positiva e limitada a 10.000 km; não é calculada como distância rodoviária a partir do mapa. Os dados exigem janela válida, com fim igual ou posterior ao início e não encerrada no momento do comando, e início não anterior à disponibilidade da oferta. Revisões de entrega são permitidas ao produtor proprietário nos estados pendente, confirmado e em preparação, sem transporte já solicitado. O evento `order_delivery_updated` mantém o estado comercial e o histórico consistente.

`Organization.logisticsProfile` é opcional: veículo, capacidade, estados atendidos, disponibilidade de referência, capacidades/restrições suportadas e fonte. Os dois parceiros existentes recebem perfis **sintéticos** de carga seca (1.000 kg) e refrigerada (1.200 kg). Não são cotações, frotas ou agenda de disponibilidade real. Não há terceiro ambiente de usuário.

## Migração 1 → 2

`DOMAIN_SCHEMA_VERSION` é 2. Novas instalações continuam usando o cenário comercial original, acrescido dos perfis sintéticos dos parceiros; nenhum pedido novo é adicionado automaticamente.

A migração valida o cenário anterior, preserva pedidos, produções, ofertas, finanças, eventos e metadados e acrescenta somente perfis ausentes dos parceiros conhecidos. Perfis já cadastrados não são sobrescritos. Não preenche destinos supostos e não cria operações ou pedidos.

Antes de escrever a versão migrada, preserva os bytes originais em `safraviva-domain.migration-v1` (ou a chave customizada equivalente). Uma cópia já existente não é sobrescrita. Falhas de validação ou escrita durante essa migração não passam pela recuperação do cenário: o original permanece na chave principal e a inicialização informa o erro. Repetir a inicialização depois de corrigir a falha é seguro. Versões futuras desconhecidas continuam bloqueadas pelo contrato existente. O mecanismo pré-existente de backup/recuperação para dados corrompidos da versão corrente foi preservado.

## Elegibilidade e autorização

O motor considera pedidos confirmados/em preparação, de organizações ativas, sem vínculo logístico anterior e sem solicitação de cancelamento pendente. A lista de entregas pendentes é limitada ao produtor ativo. Operações existentes aparecem separadamente e seus pedidos podem ter os dados revisados enquanto aguardam organização.

Sugestões analisam cargas de produtores distintos. São **sugestões não contratadas**, não contratos de participação. Nomes, peso e referências logísticas necessários à análise são apresentados; valores financeiros dos pedidos de terceiros não fazem parte da projeção.

Nesta sprint não há adesão multilateral persistida. Um produtor só pode registrar uma operação envolvendo seus próprios pedidos. O botão “Analisar apenas meus pedidos” descarta os pedidos dos demais e calcula uma nova estimativa para o subconjunto autorizado; não reaproveita o preço total do grupo como preço contratado. O serviço recusa atomicamente qualquer tentativa de registrar pedidos de outro produtor. Para formalizar transporte entre organizações será necessário um futuro fluxo de consentimento de todas as partes. Esta limitação é explícita na interface.

## Compatibilidade determinística

Parâmetros centralizados em `LOGISTICS_CONFIG`:

| Parâmetro | Valor |
| --- | --- |
| Distância máxima entre cada par de origens | 35 km |
| Distância máxima entre cada par de destinos | 20 km |
| Custo fixo estimado por viagem | R$ 120,00 |
| Custo variável estimado por km | R$ 3,00 |
| Fator de distância do compartilhamento | 1,15 |
| Máximo de pedidos por grupo sugerido | 8 |

Proximidade é medida por Haversine sobre coordenadas de referência, inclusive sintéticas quando declaradas. Todos os pares do grupo devem respeitar os limites. As janelas precisam ter interseção comum (datas inclusivas); a capacidade deve comportar a soma dos pesos. O parceiro precisa estar ativo/disponível, atender aos estados de origem/destino e suportar todas as restrições informadas. Temperatura ambiente e refrigeração não são consolidadas no mesmo grupo. Carga frágil exige capacidade compatível do parceiro.

O algoritmo ordena candidatos por ID e constrói grupos gulosos limitados, testando cada adição. É determinístico e pode deixar de identificar outras combinações economicamente melhores. Não realiza otimização combinatória, roteirização, geocodificação ou validação física dos endereços. Sem dados essenciais, sem coordenadas no compartilhamento, com janela expirada ou sem parceiro compatível, não gera recomendação definitiva. Transporte individual exige dados de entrega completos e distância de referência, mas pode ser analisado sem coordenadas.

## Fórmulas de custo

Para pesos `wᵢ` e distâncias de referência `dᵢ`:

- Custo individual total: `Σ arredondarCentavos(fixo + custoPorKm × dᵢ)`.
- Distância compartilhada estimada: `máximo(dᵢ) × 1,15`.
- Custo compartilhado total: `arredondarCentavos(fixo + custoPorKm × distânciaCompartilhada)`.
- Economia: `máximo(0, individual − compartilhado)`.
- Economia percentual: `economia / individual × 100`; denominador zero retorna indisponibilidade tipada (`null`).
- Ocupação: `somaDosPesos / capacidade × 100`.
- Rateio: proporcional ao peso, em centavos; arredonda para baixo cada parcela e atribui o resíduo ao último pedido, preservando o total exato.

Se o compartilhamento for mais caro ou igual, não se anuncia economia e a interface informa ausência de vantagem econômica estimada. Valores inválidos, não finitos, negativos e capacidade excedida são rejeitados. Não inclui pedágio, seguro, negociação ou contratos reais. Para uma seleção individual, a coluna compartilhada é uma comparação hipotética e a operação usa o custo individual.

## Registro e ciclo operacional

`LogisticsService` mantém `createOperation`, `requestTransport`, `dispatch` e `deliver` e seus contratos anteriores. Para preservar compatibilidade com comandos já usados, os caminhos legados continuam aceitando o contrato anterior. A nova interface usa os caminhos revisados:

- `saveDelivery`: registra informações de entrega e evento sem alterar finanças.
- `planningWorkspace`: leitura consistente das entregas próprias, sugestões, parceiros e operações.
- `quoteTransport`: análise determinística, sem escrita.
- `organizeTransport`: revalida propriedade, informações, parceiro, capacidade e vínculos; compara a estimativa revisada com a atual e grava operação + solicitação + eventos na mesma transação.
- `requestReviewedTransport`: solicita uma operação anteriormente organizada após rever seus dados logísticos.

A confirmação em tela é obrigatória. Cliques repetidos são bloqueados na interface e o banco serializa as transações; a associação única impede segunda operação para os mesmos pedidos. Nenhum comando novo simula a identidade de um transportador para iniciar transporte ou entregar pedidos. O produtor pode solicitar; `dispatch`/`deliver` continuam exigindo ator prestador autorizado e estados comerciais compatíveis. Não há nova interface de prestador nesta sprint. As operações podem ser acompanhadas no estado atual e no histórico, inclusive as transportadas/entregues existentes.

Solicitar transporte não muda pedidos para `in_transit` ou `delivered`. Confirmações comerciais, reservas, cancelamentos e histórico continuam nos serviços existentes. O módulo de pedidos mostra destino/janela quando cadastrados e permite ao produtor navegar à logística para revisar entrega ou consultar a operação vinculada.

## Cenário opcional e preservação do QA

A importação explícita “Cenário logístico de referência” é um importador aditivo versionado por metadados `fixture: logistics-4a-v1`, com confirmação em diálogo. Cria apenas novos registros sob o prefixo reservado `reference-4a-`: três produções/ofertas, quatro pedidos confirmados e eventos sintéticos correspondentes. Não altera registros existentes, não autoriza transporte e não é executada por inicialização/migração automática.

Santa Clara participa com 200 kg e 100 kg, Boa Esperança com 150 kg e Horizonte com 250 kg. Os pesos respeitam as novas ofertas de 500 kg por produtor. As entregas têm janela três dias após a importação, coordenadas sintéticas próximas e regime ambiente. Há oportunidade entre três produtores e oportunidade para organizar os dois pedidos próprios de Santa Clara. A repetição reconhece os eventos da versão já importada e não duplica registros; colisões parciais de identificadores são rejeitadas sem sobrescrita.

Use apenas como dados sintéticos locais: os pedidos de referência aparecem nos módulos comerciais com identificadores próprios. Não representa autorização real ou pedidos reais dessas organizações. A importação é opcional justamente para preservar o cenário comercial de QA por padrão.

## Mapa e políticas de uso

React Leaflet/Leaflet e seu CSS são carregados em chunk separado somente ao acionar “Carregar mapa”. OpenStreetMap fornece o mapa base por HTTPS com atribuição visível e link de copyright. Não há prefetch em massa, cache offline de tiles ou APIs comerciais. Os pedidos do navegador preservam seu comportamento padrão de Referer/cache. A utilização deve respeitar a [política de tiles da OSM Foundation](https://operations.osmfoundation.org/policies/tiles/) e a [atribuição do OpenStreetMap](https://www.openstreetmap.org/copyright); produção em escala pode precisar de um provedor adequado à carga.

A seleção destaca origens/destinos e enquadra os pontos do agrupamento. Popups identificam carga e fonte geográfica. Conexões pontilhadas são explicitamente esquemáticas; não se desenham rotas rodoviárias sem dados de roteamento. A cobertura cadastrada do parceiro aparece nas informações operacionais, sem inventar um polígono de atendimento.

Falhas do módulo são isoladas por Error Boundary; falhas de tiles exibem aviso. Tabelas, formulários, custos e confirmações não dependem do mapa. Testes verificam esse fallback e os dados/seleções das camadas com adaptadores de renderização, sem chamadas reais de tiles.

## Limitações e verificação

Persistência local e identificação por organização não representam backend ou autenticação real. Não há GPS, contratação, pagamento, adesão multilateral formal, agenda de frota ou otimização rodoviária. Perfis, parâmetros e pontos sintéticos são explicitamente referências. O algoritmo não valida distância informada nem garante prazo, economia real ou capacidade efetiva de uma transportadora.

Os testes abrangem compatibilidade, custo/rateio, ausência de economia, campos ausentes, fronteiras de validade, isolamento, consentimento, eventos, transições, persistência, migração com falha, importação aditiva, interface e indisponibilidade do mapa. As suítes anteriores continuam executadas. Os testes DOM não substituem revisão visual em navegador real. A Sprint 4B não foi iniciada.


## Arquivos desta entrega

- `README.md`
- `package-lock.json`
- `package.json`
- `src/data/commercial-scenario.ts`
- `src/domain/integrity.ts`
- `src/domain/order-history.ts`
- `src/domain/schemas.ts`
- `src/modules/commercial/presentation.ts`
- `src/modules/logistics/page.tsx`
- `src/modules/orders/order-panel.tsx`
- `src/repositories/local/domain-database.ts`
- `src/services/domain/logistics-service.ts`
- `src/services/domain/query-service.ts`
- `src/types/domain.ts`
- `docs/collaborative-logistics.md`
- `src/data/logistics-demo.ts`
- `src/data/logistics-reference.ts`
- `src/domain/logistics-planning.test.ts`
- `src/domain/logistics-planning.ts`
- `src/domain/logistics-schemas.ts`
- `src/modules/logistics/cost-comparison.tsx`
- `src/modules/logistics/delivery-form.tsx`
- `src/modules/logistics/map-panel.tsx`
- `src/modules/logistics/operational-map.test.tsx`
- `src/modules/logistics/operational-map.tsx`
- `src/modules/logistics/page.test.tsx`
- `src/modules/logistics/transport-panel.tsx`
- `src/modules/logistics/types.ts`
- `src/repositories/local/domain-migrations.ts`
- `src/services/domain/logistics-planning-service.test.ts`
- `src/types/logistics.ts`
