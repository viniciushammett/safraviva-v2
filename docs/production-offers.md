# Produção e Ofertas — Sprint 3A

## Arquitetura

A página de operação atende somente ao perfil produtor ativo. `DomainQueryService.producerWorkspace(organizationId)` filtra produções e ofertas por proprietário e entrega seus valores analíticos com os cálculos existentes: `allocatedProductionQuantity`, `commercialVolume`, `committedQuantity` e `availableQuantity`. Não há cálculos paralelos de estoque nos componentes React.

As operações usam exclusivamente `CommercialService`: criação e edição de produção, criação e edição de oferta, publicação/reativação, pausa e encerramento. A persistência, validação de integridade e eventos permanecem em `LocalDomainDatabase` e seus contratos. Não foi adicionado outro armazenamento. As revisões do store Zustand atualizam as tabelas. `useDomainQuery` ganhou uma opção compatível `keepPreviousData`, desativada por padrão, que mantém o mesmo snapshot durante uma atualização para preservar os formulários abertos. O snapshot anterior não é reaproveitado ao mudar a função de consulta/organização; os comandos sempre validam o estado atual do banco.

## Interface

Duas abas com tabelas, busca por produto/identificação, filtro por status e contagens dos registros. Os painéis laterais reutilizam Dialog/Radix, com foco, fechamento por teclado, descrição e rolagem. Cadastros/edições usam React Hook Form e schemas Zod existentes. Publicação, pausa, reativação e encerramento exigem confirmação; falhas do domínio permanecem visíveis no formulário ou diálogo e não geram sucesso fictício.

Edição de produção preserva o produto e oferece as transições atuais: cultivo para colhida e colhida para finalizada. A produção finalizada permite somente consulta. Edição de oferta preserva a produção vinculada; ofertas encerradas permitem somente consulta. O domínio impede volumes acima do comercializável e abaixo dos comprometidos.

Pedidos pendentes não reservam estoque. A coluna “Reservado / vendido” inclui pedidos confirmados, em preparação, em transporte e entregues, seguindo a função existente. Fechar uma oferta não libera volumes comprometidos, e não implica cancelamento de pedidos. Saldo positivo em oferta pausada ou encerrada não significa disponibilidade para novas solicitações.

## Disponibilidade

Oferta imediata exige produção colhida e disponibilidade até o dia atual. Para cumprir a Sprint 3A, `validateAvailability` também exige que a disponibilidade futura seja posterior ao dia atual, além de não anteceder a colheita prevista. Essa verificação é compartilhada pela criação, edição e publicação. Uma oferta futura cuja data já passou precisa de ajuste antes de edição/publicação: atualize sua disponibilidade ou use disponibilidade imediata após a colheita.

A data atual segue a convenção UTC do serviço existente e o relógio injetável `CommandEnvironment`; não há relógio de negócio paralelo em React. Ofertas futuras continuam sujeitas aos contratos existentes, inclusive quando uma produção colhida reserva volume para entrega posterior.

## Integração com planejamento

A ação no resultado do simulador aparece em contexto de navegação e perfil produtor. A navegação tipada transporta apenas a intenção `market-planning` e a organização destinatária. Os dados são lidos do resultado completo do simulador já mantido em `useIntelligenceSession`, sem copiar seu estado para outro store.

O destino valida a intenção, a organização, o input com `commercialPlanSchema` e o rascunho com `createProductionSchema`. Abre o formulário com produto, quantidade prevista e data. Região e preço desejado são apresentados como contexto do plano: não são atributos de Production e não são enviados como tais ao comando. O usuário deve revisar e confirmar; navegar ou fechar o painel não grava produção.

Depois da confirmação, “Criar oferta” na linha da produção reaproveita o preço desejado durante a permanência na página. Essa sugestão é local e não altera o contrato persistido de Production. Atualizar/sair da página descarta a sugestão, mas preserva os registros comerciais gravados. Uma intenção sem simulação válida informa a ausência; não inventa dados. A intenção do histórico é consumida para evitar reabrir automaticamente o cadastro.

## Verificação e limites

Testes cobrem tabelas, abas, busca/filtros, cadastros, validações, detalhes, edições, transições, reservas, excesso de volume, ofertas futuras, confirmação/cancelamento, erros, persistência, consultas isoladas por organização, atualizações externas e integração com o planejamento. As suítes anteriores de inteligência e navegação continuam executadas.

Persistência continua local ao navegador, sem backend ou autenticação real. Não há gestão visual de pedidos, marketplace ou logística. Preço de oferta não negativo segue o contrato anterior, que permite zero. Colheita real pode divergir da estimativa; os limites comerciais usam o volume efetivamente comercializável conforme o status, sem impor igualdade artificial entre previsão e colheita. Não foi implementada a Sprint 3B. Testes DOM não substituem uma revisão visual em navegador real.
