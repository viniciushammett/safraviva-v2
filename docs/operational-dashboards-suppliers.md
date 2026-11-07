# Dashboards e Fornecedores — Sprint 4B

## Arquitetura

`operational-analytics.ts` contém cálculos e projeções puros. `DashboardService.overview` lê um snapshot consistente, valida organização ativa e perfil comercial, aplica isolamento e compõe as consultas. `MarketIntelligenceService` lê esse mesmo snapshot para as recomendações; consolidação usa o motor logístico existente. Não há gravação ou cache persistido de indicadores.

`DomainQueryService.suppliers` valida o comprador e produz o diretório a partir dos registros existentes. `availableCatalog` foi extraído da consulta anterior para reutilização por marketplace, diretório e dashboard; mantém as mesmas regras de publicação, saldo e produtor ativo. Não houve mudança em reservas, comandos comerciais, estados logísticos ou schema do domínio.

A interface reutiliza `PageHeader`, `StatusBadge`, `Button`, `EditorPanel`, `useDomainQuery` e as revisões do domínio. O gráfico Recharts é carregado sob demanda. A página remove os cartões de navegação, o cartão da organização e textos de funcionalidades futuras, mantendo a saudação para compatibilidade de navegação.

## Definições dos indicadores

Todos os indicadores gerais representam o histórico completo da organização. O filtro de 7, 30 ou 90 dias altera somente o gráfico, conforme indicado na tela.

- Vendas/compras realizadas: soma em centavos dos totais gravados em pedidos com status `delivered`, respectivamente do produtor ou comprador ativo. São valores brutos de pedidos entregues, não lucro nem comprovação de pagamento.
- Pendentes: contagem de `pending_confirmation`. Esses pedidos não reservam estoque.
- Em andamento: contagem de `confirmed`, `preparing` e `in_transit`. Não inclui entregue, recusado ou cancelado.
- Produção disponível: soma de `commercialVolume` das produções próprias não finalizadas menos `committedQuantity` em todas as suas ofertas. Inclui previsão em cultivo e volume colhido conforme o status. Ofertas anunciadas/rascunhos não reduzem esse indicador por si: a quantidade é descontada quando comprometida. Volume já entregue continua consumido. Produções finalizadas ficam fora do disponível. O indicador não é sinônimo de ofertas publicadas disponíveis hoje.
- Fornecedores ativos: número distinto de produtores ativos que possuem ao menos uma oferta publicada com saldo disponível no catálogo. Não significa número de favoritos, contratos vigentes ou total de produtores cadastrados. O diretório inclui também produtores sem ofertas e produtores inativos, identificados na interface.

Funções de estoque e totalização existentes são reutilizadas. Componentes apenas formatam os resultados.

## Gráfico e histórico

O gráfico contém uma barra diária para cada dia UTC, incluindo hoje e os `N−1` dias anteriores. O horário máximo é o instante de referência do serviço. A data vem de `order_delivered` no histórico, nunca de `requestedAt` ou de uma atualização posterior do pedido. Pedidos sem evento de entrega verificável ficam fora do gráfico e geram uma indicação de quantidade excluída. Valores futuros não são contabilizados.

Dias sem eventos têm zero: representam ausência de entregas registradas, não estimativas. Cancelados, recusados, pendentes e pedidos em trânsito não compõem o gráfico. O total usa os valores contratados do pedido, não preços atuais de ofertas. A série e seus totais são derivados, sem persistência independente.

Pedidos recentes são os cinco mais recentemente solicitados, com desempate por ID; mostram todos os estados, inclusive recusados/cancelados, para acompanhamento. Cada link abre o detalhe do pedido por `?order=ID`, mantendo a validação por organização no destino.

## Recomendações e alertas

`DASHBOARD_CONFIG` centraliza: cinco pedidos recentes, no máximo três oportunidades e horizonte de sete dias para alertas de disponibilidade.

O produtor recebe até três análises válidas de 30 dias para produtos das suas produções, priorizando classificações `opportunity`. Demais classificações continuam recomendações orientativas do motor, sem reclassificação no frontend. Região, tendência, referência e metodologia permanecem acessíveis. Sem análises válidas há estado de indisponibilidade, sem mensagens inventadas.

Alertas são derivados de solicitações próprias pendentes, ofertas próprias publicadas com saldo e disponibilidade futura entre hoje e sete dias à frente (datas inclusivas), ofertas próprias publicadas sem saldo e oportunidades realmente retornadas pelo motor logístico. Cada categoria leva ao módulo responsável. Nenhuma categoria com contagem zero é apresentada como alerta.

O comprador recebe até três ofertas publicadas com saldo, priorizando produtores no mesmo município/UF; em seguida, mesma UF e demais localidades. Desempates usam disponibilidade e ID. Essa prioridade é cadastral, não uma inferência geográfica de entrega. O link `?offer=ID` abre a oferta no marketplace. O destino reconsulta o catálogo: oferta que deixou de estar disponível é informada como indisponível.

## Diretório e perfil comercial

Fornecedores é exclusivo do comprador. Lista produtores cadastrados, localidade, produtos em ofertas publicadas (incluindo esgotadas) ou em seu histórico próprio de entregas, quantidade de ofertas ativas e histórico concluído com o comprador atual. Produtos de rascunhos e finanças de outros compradores não são expostos.

O painel apresenta situação cadastral, localidade, produtos, ofertas publicadas com saldo, pedidos entregues e total comprado concluído. Localidade não é cobertura logística garantida. Pesquisa aceita nome/produto, e filtros aceitam localidade e favoritos. Há estados vazios e erros explícitos.

Links para o marketplace usam `?producer=ID` para filtrar o fornecedor; “Mostrar todos os fornecedores” remove esse filtro na tela. Parâmetros nunca ampliam o escopo de autorização: a consulta de pedidos continua filtrada pela organização ativa e o marketplace continua limitado ao catálogo disponível. Navegação entre módulos não requer alteração das rotas por perfil.

## Favoritos e persistência

`SupplierFavoritesRepository` grava apenas IDs em `safraviva-supplier-favorites`, envelope de preferências versão 1 com conjuntos por organização compradora. `SupplierFavoritesService` exige comprador ativo e produtor cadastrado. Não adiciona coleções ou migrações ao domínio comercial e não modifica o cenário de QA.

Escritas são serializadas por adaptador, com Web Locks onde disponíveis, preservando conjuntos de outros compradores. IDs são deduplicados. A interface só confirma sucesso após a gravação. Falhas de quota/leitura são informadas; preferências inválidas não são apagadas ou substituídas. Se favoritos não puderem ser lidos, o diretório e os perfis continuam disponíveis, mas controles de favoritos ficam indisponíveis para evitar estados falsos.

Zustand guarda somente metadados de invalidação das preferências. Escritas notificam a mesma aba; eventos `storage` atualizam a tela em outras abas do mesmo navegador. Mudar organização limpa seleção e filtros. O armazenamento continua restrito ao navegador/origem, sem autenticação real, sincronização remota ou CRM.

## Testes e limites

A suíte cobre indicadores, isolamento, precisão monetária, produção disponível, períodos e limites UTC, evento ausente, exclusão de recusas/cancelamentos, oportunidades e alertas reais, diretório, perfil e privacidade do histórico, favoritos por comprador, concorrência local, recarga, erros e eventos entre abas, links e navegação de detalhe, atualizações comerciais e as suítes anteriores.

Dados continuam os registros existentes, inclusive cenários sintéticos quando identificados pela metodologia. Não há receita inventada para tornar o gráfico preenchido. As recomendações continuam determinísticas e não garantem resultado comercial. Persistência e autorização são locais; não há backend, pagamentos, IA generativa ou integração externa nova. A Sprint 5 não foi iniciada.


## Validação e arquivos da entrega

337 testes aprovados (283 anteriores e 54 novos), em 18 arquivos de testes. ESLint sem erros/avisos; TypeScript strict e build de produção aprovados. O build mantém avisos anteriores de empacotamento e comentários do Zod. Não houve nova validação visual em navegador real nesta sprint; a cobertura de interface usa DOM simulado e gráficos com dimensões fixadas nos testes.

- `README.md`
- `src/modules/dashboards/overview-page.tsx`
- `src/modules/marketplace/page.tsx`
- `src/modules/orders/page.tsx`
- `src/modules/suppliers/page.tsx`
- `src/services/domain/index.ts`
- `src/services/domain/query-service.ts`
- `docs/operational-dashboards-suppliers.md`
- `src/domain/operational-analytics.test.ts`
- `src/domain/operational-analytics.ts`
- `src/modules/dashboards/overview-page.test.tsx`
- `src/modules/dashboards/performance-chart.tsx`
- `src/modules/dashboards/recent-orders.tsx`
- `src/modules/suppliers/page.test.tsx`
- `src/modules/suppliers/supplier-panel.tsx`
- `src/repositories/supplier-favorites-repository.ts`
- `src/services/domain/dashboard-service.test.ts`
- `src/services/domain/dashboard-service.ts`
- `src/services/domain/supplier-favorites-service.test.ts`
- `src/services/domain/supplier-favorites-service.ts`
- `src/stores/supplier-favorites-store.ts`
