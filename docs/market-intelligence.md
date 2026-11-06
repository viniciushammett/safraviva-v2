# Inteligência comercial — Sprint 2B.1

Motor independente de React, sem APIs externas, dependências adicionais ou escrita de estado. `MarketIntelligenceService` recebe o contrato de leitura `snapshot` de `DomainUnitOfWork`. Importar diretamente seu módulo para uso sem inicializar os serviços do navegador.

## Contratos

- `query({ productId, region, periodDays })`: aceita somente 7, 15 e 30 dias. Retorna união discriminada por `status`. Motivos de indisponibilidade: período inválido, produto inexistente, região inexistente, combinação ausente ou dados insuficientes. Região e produto exigem correspondência exata. Entre análises da mesma combinação, usa a data mais recente; empates usam o ID em ordem crescente.
- O resultado disponível contém o produto e o `MarketAnalysis` existente, incluindo região, período, volumes em kg, preço por kg, tendência, data de referência e metodologia. `indicators` oferece diferença em kg, razão e razão multiplicada por 100 para exibição percentual. Por exemplo, razão 1,2 significa demanda igual a 120% da oferta, não diferença de 120%.
- `simulate({ productId, region, plannedQuantityKg, expectedHarvestDate, desiredPricePerKg })`: quantidade positiva até 1 bilhão com precisão de gramas; preço positivo até 1 bilhão com precisão de centavos; data civil ISO válida. Datas passadas válidas são aceitas para análise consultiva. Usa exclusivamente a referência de 30 dias, sem extrapolar para a colheita. Ausência de análise resulta em preços comparativos nulos e classificações insuficientes, mantendo a receita aritmética do plano.
- `productionDraft` reutiliza os campos de `createProductionSchema`. Para um cadastro posterior ainda é necessário validar o produto e selecionar a organização produtora autorizada. Região e preço pretendido permanecem no resultado do plano: não são campos de Production. Nenhum cadastro é criado.

## Cálculos e regras

Cálculos puros em `src/domain/market-intelligence.ts`. A diferença é demanda menos oferta; a razão é demanda dividida pela oferta. Oferta zero produz razão e percentual nulos. Demanda positiva com oferta zero pode indicar oportunidade; ambos os volumes zero indicam insuficiência. Referência zero torna a análise insuficiente e a função isolada de comparação de preços rejeita esse denominador. Entradas não finitas ou negativas são rejeitadas pelos cálculos.

A diferença de preço é `(desejado - referência) / referência * 100`. A receita usa a mesma convenção de gramas e centavos de `orderTotal`, arredondando para centavos. Não é lucro e não deduz custos. Quantidades da diferença são arredondadas para gramas. Razões e percentuais preservam precisão para apresentação futura.

`RECOMMENDATION_CONFIG` é tipada, imutável e centraliza os limites inclusivos:

| Parâmetro | Valor | Efeito |
| --- | --- | --- |
| opportunityRatio | 1,1 | Demanda pelo menos 110% da oferta, com tendência crescente ou estável: oportunidade |
| oversupplyRatio | 0,9 | Demanda até 90% da oferta: excesso de oferta |
| highPricePremiumPercent | 10 | Preço pretendido pelo menos 10% acima da referência: risco alto |

Excesso de oferta tem precedência; demais casos são equilibrados, incluindo demanda excedente com tendência declinante. Estes são parâmetros demonstrativos explícitos, sem calibração empírica.

Risco alto: excesso de oferta OU prêmio de preço pelo menos 10%. Risco moderado: prêmio positivo abaixo de 10%, tendência declinante OU condição equilibrada. Risco baixo: oportunidade com preço até a referência. Sem dados suficientes: `insufficient_data`. Quando não informado o preço para a recomendação isolada, assume-se comparação na referência. O simulador sempre fornece preço.

O período delimita a análise selecionada e consta da recomendação; não altera artificialmente os limites. A tendência é o sinal declarado no `MarketAnalysis`, não uma tendência inferida de volumes acumulados entre janelas de tamanhos diferentes.

## Cenário e limitações

Os registros anteriores de Tomate, Batata e Milho permanecem intactos. Tomate Italiano é um produto específico adicional; Alface Crespa e Cenoura completam os quatro produtos solicitados. A região canônica é `Região de Campinas/SP`, agregando Campinas, Valinhos e Indaiatuba. Não há dados para consultas municipais separadas.

Os quatro produtos têm períodos de 7, 15 e 30 dias, com taxas diárias sintéticas constantes, volumes acumulados crescentes e preços/sinais consistentes entre períodos. Todos são identificados como sintéticos pela metodologia obrigatória, sem alterar o schema estrito da Sprint 2A.

Não há migração ou restauração automática de cenários persistidos: instalações antigas continuam válidas e retornam indisponibilidade para as combinações ausentes. O cenário ampliado é usado em novas inicializações ou na restauração explícita já existente.

O motor não modela custos, clima, sazonalidade, logística, capacidade de absorção do volume planejado, validade temporal ou incerteza estatística. Não infere demanda a partir dos pedidos existentes, não verifica se a análise ainda é atual e não faz previsão de colheita. Data e metodologia devem acompanhar a apresentação dos resultados. Recomendações e risco são orientativos e não constituem avaliação financeira definitiva. A interface operacional da Sprint 2B.2 consome esses contratos sem alterar as regras do motor.


## Interface operacional — Sprint 2B.2

A página de Inteligência de Mercado reutiliza `PageHeader`, `Button`, o store de sincronização e `useDomainQuery`. As opções vêm do snapshot comercial, limitadas aos produtos que possuem análises e às regiões cadastradas nelas. Uma combinação específica ainda pode estar indisponível; esse estado é mostrado sem indicadores ou gráfico fictícios.

`AnalysisResult` apresenta os indicadores e recomendações retornados por `query`. `MarketChart` usa Recharts com barras agregadas, tooltip em kg, legenda, adaptação à largura e resumo textual acessível. Carrega sob demanda; não existe série diária inferida. Metodologia e referência ficam em painel expansível.

`PlanningForm` usa React Hook Form e `zodResolver` com `commercialPlanSchema`, exportado do serviço e também usado por `simulate`. As regras de validação não foram copiadas para React. O resultado mantém o objeto completo, inclusive `productionDraft`, junto do input submetido. Edições posteriores do formulário não mudam os resultados anteriores e exigem nova simulação; a identificação do plano submetido permanece visível. Não há botão de cadastro: ainda falta o contrato autorizado com o módulo de produção.

`useIntelligenceSession` é um store Zustand somente em memória para filtros, formulário e resultados. Navegar entre módulos preserva a sessão; recarregar a aplicação a descarta. Não escreve no cenário comercial nem acessa localStorage. Mudanças de revisão do domínio geram avisos para atualizar consultas e simulações anteriores. Não há restauração ou migração automática dos cenários antigos.

A interface identifica o cenário de referência e disponibiliza a metodologia sintética completa. A simulação sempre usa 30 dias independentemente do filtro de consulta. A data de colheita é informativa. Não há cadastro de produção ou implementação da Sprint 3.

Validação automatizada: testes do motor, persistência, navegação e página, incluindo opções, filtros, gráfico real com dimensão fixa no ambiente de testes, recomendações, erros, indisponibilidade, preservação de sessão e comparação integral do estado comercial antes/depois de simular. Os testes DOM não substituem revisão visual em navegador real.
