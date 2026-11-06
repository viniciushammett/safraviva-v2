# Marketplace B2B e pedidos — Sprint 3B

## Fluxo operacional

O comprador acessa Mercado Agrícola, pesquisa produtos/fornecedores e filtra por origem, categoria e disponibilidade. Somente ofertas publicadas, com saldo e produtor ativo entram no catálogo. Rascunhos, pausadas, encerradas e ofertas totalmente comprometidas ficam fora da consulta. Origens são as cidades/UF das organizações produtoras cadastradas.

O painel apresenta os dados existentes e permite solicitar uma quantidade em kg. React Hook Form e Zod reutilizam a quantidade de `requestOrderSchema`; o total estimado usa `orderTotal`, inclusive sua convenção de gramas e centavos. O serviço consulta preço e saldo novamente ao confirmar. A tela mostra o total efetivamente registrado após a operação. O serviço não oferece negociação ou bloqueio de cotação: se o preço da oferta mudar antes do envio, vale o preço atual lido pelo comando.

A solicitação é criada exclusivamente por `CommercialService.requestOrder`, com evento e recibo idempotente. Uma tentativa repetida com a mesma quantidade conserva sua chave, inclusive após uma resposta incerta; após sucesso, o formulário é substituído pela confirmação e pelo link para Pedidos e Compras. A confirmação indica explicitamente que não houve reserva. Uma nova abertura do painel representa uma nova intenção de compra.

O produtor consulta Pedidos e Vendas e abre o painel para aceitar ou recusar solicitações, iniciar preparação e aprovar cancelamentos. O comprador consulta Pedidos e Compras e pode cancelar pendentes ou solicitar aprovação para cancelar confirmados/em preparação. Todas as ações relevantes exigem confirmação e os erros ficam visíveis no diálogo. Sucessos são informados também dentro do painel aberto.

## Contratos e integridade

Não houve alteração dos contratos persistidos ou das regras de `CommercialService` nesta sprint. `DomainQueryService` foi estendido com projeções de leitura:

- `marketplace(organizationId)` exige organização compradora ativa e reutiliza o catálogo de ofertas disponíveis.
- `ordersWorkspace(organizationId)` exige organização comercial ativa e limita os pedidos pelo campo do perfil correspondente (comprador ou produtor). Os dados são montados em um único snapshot consistente.
- O catálogo contém informações do produto, produtor e origem, além do saldo calculado por `availableQuantity`.
- Os pedidos contêm nomes das partes, preço unitário/total gravados no pedido, histórico registrado, sinal de cancelamento pendente e ações de apresentação. O preço contratado não é substituído pelo preço atual da oferta.
- A projeção logística contém identificação, situação, modalidade e transportador. Não expõe os IDs de outros pedidos que compartilhem uma operação.

`availableOrderActions`, no domínio, descreve as ações apresentáveis por perfil/status. Não executa transições nem calcula estoque. Os comandos comerciais continuam sendo a autoridade e revalidam organização, propriedade, saldo e transição no momento da escrita. Uma revisão concorrente pode invalidar uma ação aberta; o erro é apresentado sem simular sucesso.

Pedidos pendentes não reservam. Aceitar reserva o volume após revalidação. Recusar não reserva. Cancelar um pendente preserva seu histórico. Solicitar cancelamento após confirmação conserva o status e a reserva; somente a aprovação pelo produtor libera o comprometimento. Cancelamento após início do transporte não está disponível. O serviço atual não oferece recusa formal de uma solicitação de cancelamento; a interface permite consultar/analisar e aprovar, sem criar um comando fictício.

## Histórico, entrega e sincronização

A linha do tempo usa somente `DomainEvent` do pedido, em ordem cronológica, preservando a ordem de inserção nos empates. Exibe datas, descrições e destaca o evento mais recente correspondente ao status atual. Não cria etapas futuras como se já tivessem ocorrido. Recusas e cancelamentos permanecem no histórico.

A etapa logística é apenas consulta da operação existente. Não há controles de transporte, GPS ou previsão de entrega. Cidade da organização compradora não equivale a endereço de entrega confirmado. Frete, forma de pagamento, endereço e prazo negociado não existem no contrato atual; a interface informa essa ausência em vez de inventar condições.

A atualização utiliza `useDomainQuery`, revisões do store de domínio e `LocalDomainDatabase` já existentes. Trocar organização remonta o estado de apresentação e limpa seleções/filtros para impedir vazamento de detalhes. Operações atualizam catálogo e pedidos nos dois ambientes. O evento de storage existente continua sincronizando abas do mesmo navegador. A persistência segue local, sem backend ou autenticação real.

## Verificação

A suíte cobre catálogo elegível, filtros, detalhes, quantidades, total, solicitação/evento, idempotência em resposta incerta, ausência de reserva inicial, confirmação, saldo insuficiente, recusa, preparação, cancelamento pendente, solicitação e aprovação de cancelamento, liberação de saldo, histórico, entrega real registrada, isolamento, persistência e jornada entre perfis. As suítes anteriores de produção, inteligência, domínio, stores e navegação permanecem executadas.

Testes DOM não substituem revisão visual em navegador real. A sprint não adiciona dependências, carrinho, pagamentos, backend ou gestão visual de logística. A Sprint 4 não foi iniciada.
