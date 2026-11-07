# SafraViva 2.0

Plataforma de Inteligência Comercial Agrícola com inteligência de mercado, produção, ofertas, marketplace, pedidos e logística colaborativa local. Implementação concluída até a Sprint 4A.

## Execução

Node.js 22.13+ e npm 10+ (validado com Node 22.22.2).

```bash
npm ci
npm run dev
```

Acesse o endereço informado pelo Vite, normalmente http://localhost:5173.

```bash
npm test        # Testes de domínio, persistência, hooks e navegação
npm run lint   # ESLint
npm run build  # TypeScript strict e bundle em dist/
npm run preview
```

Produção requer fallback de todas as rotas SPA para `index.html`. Não há variáveis de ambiente obrigatórias ou backend. O mapa opcional usa tiles públicos do OpenStreetMap e requer conexão. O restante do fluxo funciona sem chamadas externas. Inter é servida localmente.

## Stack e estrutura

React, TypeScript strict, Vite, Tailwind CSS 3, shadcn/ui sobre Radix UI, React Router, Zustand, Lucide e Zod. Zod valida comandos e todo snapshot de domínio lido ou gravado. O lockfile fixa a resolução das dependências. O override de `minimatch` mantém a versão corrigida nas ferramentas de lint. Não há dependências de mapas, gráficos ou formulários sem uso.

```text
src/
  app/                      Layout, rotas por perfil e provider de feedback
  components/               UI, navegação e feedback preservados da Sprint 1
  modules/                  Páginas e componentes operacionais por módulo
  types/domain.ts           Modelos das nove entidades e contratos auxiliares
  domain/                   Schemas, integridade, cálculos, histórico e erros
  data/commercial-scenario.ts Cenário sintético determinístico
  repositories/contracts/   Contratos de leitura, armazenamento e unidade de trabalho
  repositories/local/       Repositórios locais e persistência transacional
  services/domain/          Regras comerciais, logística e consultas
  stores/domain/            Sinalização de revisão, inicialização e hook de consulta
  stores/workspace-store.ts Seleção de ambientes original, preservada
  lib/ e styles/            Utilitários e estilos existentes
```

Os imports internos usam `@/`. A direção de dependências é **React → serviços → repositórios → localStorage**. Componentes não acessam armazenamento local. Repositórios públicos oferecem `list`, `findById` (retorna `null`) e `getById` (erro `NOT_FOUND`); implementações são geradas por fábrica tipada para as nove entidades. Escritas comerciais passam pela unidade de trabalho para evitar salvar entidades e histórico separadamente.

As APIs de repositórios e serviços são assíncronas. Um futuro adaptador REST deve preservar a atomicidade de cada comando e sua chave idempotente no servidor, em vez de fazer múltiplos PUTs independentes. Os guards de frontend e a identificação do ator por organização não representam autenticação ou autorização de segurança.

## Interface preservada

Seleção e alternância entre Fazenda Santa Clara/João Oliveira e Mercado Bom Preço/Mariana Costa; header corporativo, sidebar recolhível, menu móvel, configurações demonstrativas, feedback, foco visível e estados de funcionalidades em preparação.

| Produtor | Comprador |
| --- | --- |
| `/producer/overview` | `/buyer/overview` |
| `/producer/intelligence` | `/buyer/marketplace` |
| `/producer/production` | `/buyer/orders` |
| `/producer/orders` | `/buyer/suppliers` |
| `/producer/logistics` | — |

`/` mantém o seletor. Rotas de perfil incompatível redirecionam para a visão geral ativa. Demais endereços desconhecidos têm tratamento próprio. O domínio das oito organizações não amplia o seletor visual nesta sprint: somente os dois ambientes originais continuam disponíveis na interface.

## Domínio e regras

- **Production:** pertence a produtor ativo; produto obrigatório; quantidade estimada positiva e colhida não negativa. Volume comercializável é estimativa durante cultivo e quantidade efetivamente colhida depois. Colheita pode superar a estimativa. Status progride de `growing` para `harvested` e `finished`; produção finalizada não aceita novas ofertas ou edições.
- **Offer:** só o produtor proprietário cria, edita ou publica. Rascunhos, publicadas e pausadas consomem volume anunciado da produção. Encerramento libera apenas o saldo não comprometido. Oferta encerrada não reabre. Quantidade não pode ficar abaixo do volume reservado/vendido. Oferta imediata exige colheita e data não futura; oferta futura não pode anteceder a previsão de colheita.
- **Order:** apenas comprador ativo solicita oferta publicada com saldo. Pedido pendente **não reserva volume**, permitindo solicitações concorrentes. Confirmação exclusiva do produtor revalida oferta publicada e saldo, reservando atomicamente. O preço é congelado na solicitação; futuras edições da oferta não alteram o pedido.
- **Cancelamento:** comprador cancela pendente diretamente. Em `confirmed` ou `preparing`, solicita aprovação; a reserva permanece até aprovação do produtor. Transporte iniciado impede solicitação e aprovação. Cancelamento aprovado libera volume e recalcula eventual carga logística ainda não despachada.
- **Logística:** produtor organiza os próprios pedidos confirmados/em preparação e seleciona parceiro logístico ativo; parceiro designado despacha e entrega. Despacho exige todos os pedidos ativos em preparação. Capacidade, duplicidade, vínculo, estados e carga são validados. Transporte compartilhado permite múltiplos pedidos do mesmo produtor. Pedidos cancelados antes do despacho permanecem como vínculo histórico, sem compor carga; operação sem carga não pode sair.
- **Reservas:** `confirmed`, `preparing`, `in_transit` e `delivered` consomem volume. Entrega não repõe estoque; rejeição e cancelamento não consomem.
- **Precisão:** kg admite até três casas decimais (gramas), preços até duas. Total do pedido arredondado ao centavo a partir de gramas e centavos inteiros. Números não finitos, negativos e fora dos limites definidos no schema são rejeitados. Quantidade zero é aceita apenas em campos que representam ausência de colheita/carga/estimativa de análise; preço zero é permitido pela regra de não negatividade.
- **Totais comerciais:** calculados pelos pedidos comprometidos, sem saldos financeiros agregados persistidos por organização. `Order.totalAmount` e `LogisticsOperation.totalLoadKg`, exigidos pelos modelos, são derivados e revalidados em toda gravação.

Erros expõem `DomainError.code` (`FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `INVALID_TRANSITION`, `INSUFFICIENT_STOCK`, `CONFLICT`, entre outros). Não são engolidos pelos serviços comerciais: uma falha de persistência rejeita o comando.

### Exemplo de uso pelos próximos módulos

```ts
import { commercialService, domainQueryService } from '@/services/domain'
import { initializeDomain } from '@/stores/domain/domain-store'

await initializeDomain()
const offers = await domainQueryService.availableOffers()
const order = await commercialService.requestOrder('bom-preco', {
  offerId: offers[0].id,
  quantityKg: 10,
  idempotencyKey: crypto.randomUUID(),
})
await commercialService.confirmOrder(order.producerOrganizationId, order.id)
```

A mesma execução deve reutilizar a **mesma** chave ao repetir a solicitação. A chave é associada à organização compradora e ao payload canônico; repetição devolve o pedido existente, inclusive após recarregamento. Reutilizá-la com outro payload gera `CONFLICT`. Outra chave representa uma solicitação intencionalmente nova.

## Cenário inicial sintético

Oito organizações: Fazenda Santa Clara, Sítio Boa Esperança, Fazenda Horizonte, Mercado Bom Preço, Restaurante Central, Hortifruti Regional e os parceiros fictícios Rotas do Campo Transportes e Carga Verde Logística. Os identificadores das organizações e nomes dos usuários da Sprint 1 são preservados; usuários adicionais possuem organizações válidas.

Três produtos em kg (tomate, batata e milho), quatro produções em diferentes estágios, cinco ofertas incluindo imediatas/futuras/rascunho/encerrada, oito pedidos cobrindo todos os estados comerciais, três operações logísticas e três análises de mercado para Campinas. Valores e datas fixos tornam o cenário reproduzível. `methodology` identifica explicitamente cada análise como **sintética**, sem medições, cotações ou previsões reais.

## Histórico operacional

Eventos incluem identificador, agregado, tipo, timestamp, ator e dados da operação. Alterações comerciais carregam `fromStatus`/`toStatus`; criação e edição incluem quantidades, preços ou alterações pertinentes. Transporte inclui referência à operação logística. Há eventos para criação de produção/oferta, publicação/pausa/encerramento, solicitação/confirmação/recusa/cancelamento/preparação, solicitação de cancelamento, transporte, despacho e entrega.

O histórico dos pedidos é validado contra as transições permitidas e o estado final persistido, incluindo responsáveis e vínculos logísticos. Entidades, eventos e recibos idempotentes são gravados juntos. Isso é um histórico operacional local com snapshot, não uma infraestrutura externa de mensageria ou um event store capaz de reconstruir todo o banco apenas pelos eventos.

## Persistência, recuperação e restauração

- Chave `safraviva-domain`, envelope `{ schemaVersion: 2, initializedAt, data }`.
- Inicialização automática em segundo plano no primeiro acesso, carregada separadamente para preservar o carregamento da interface. Recarregamentos validam e reutilizam o cenário, sem recriá-lo.
- Tipos, identificadores únicos, referências, papéis organizacionais, volumes, totais, carga, estados e histórico comercial são validados no carregamento e antes de cada commit.
- JSON/dados inválidos no schema atual são copiados integralmente para `safraviva-domain.recovery` antes da restauração automática controlada. A última cópia de recuperação é mantida; não é um arquivo ilimitado de backups.
- O schema 1 é migrado aditivamente para 2 com backup. Falhas de migração preservam o cenário anterior. Versões futuras desconhecidas são bloqueadas sem sobrescrita.
- Erros de leitura/gravação, armazenamento bloqueado ou quota excedida são reportados. Não há fallback comercial silencioso para memória, que poderia aparentar persistência inexistente.
- Escrita em um único `setItem`, com fila por adaptador para serializar comandos na mesma aba. Web Locks, quando disponível, coordena instâncias/abas cooperantes. Eventos `storage` invalidam consultas de outras abas. Sem Web Locks, a garantia é limitada à mesma aba/adaptador; não há garantia de concorrência distribuída ou contra manipulação externa do localStorage.
- `safraviva-workspace` e seu store original são independentes: a inicialização e a restauração do domínio não mudam o ambiente ativo nem a preferência da sidebar.

A restauração exige confirmação explícita do chamador, após obter confirmação do usuário em uma futura interface:

```ts
import { restoreInitialScenario } from '@/services/domain'
await restoreInitialScenario({ confirmed: true })
```

`{ confirmed: false }` é rejeitado. Não foi criado botão, diálogo ou fluxo visual de restauração nesta sprint.

## Zustand e consultas React

`useDomainStore` guarda somente revisão, estado da inicialização, resultado da recuperação e erro. Não mantém cópia das entidades. `useDomainQuery` executa uma função estável de consulta (definida no módulo ou com `useCallback`) e oferece `data`, `loading` e `error`; revisões invalidam resultados, inclusive após restauração. O hook protege contra respostas obsoletas e desmontagem. As telas operacionais consomem os serviços sem acessar localStorage. A opção keepPreviousData preserva formulários durante atualizações da mesma consulta.

## Verificação

A suíte automatizada completa cobre criação, limites, reservas, confirmação concorrente, idempotência persistida, cancelamentos, logística, históricos, referências inválidas, precisão decimal, falhas de armazenamento, recarga, restauração, schema incompatível, sincronização Zustand e todas as nove rotas. Os testes usam DOM simulado; não substituem validação visual em navegador real.

Lint e build devem passar com os comandos acima. O build pode emitir avisos de comentários `@__PURE__` dentro do Zod; o Rollup remove essas anotações, sem falha de compilação. A auditoria desta entrega foi executada contra o registro npm e não reportou vulnerabilidades.

## Limitações e próximos passos

Sem backend, autenticação real, pagamentos, GPS, otimização rodoviária ou contratação externa. O mapa opcional usa OpenStreetMap; cálculos comerciais e logísticos continuam locais. Os serviços operam por identificador de organização fornecido pelo chamador, sem identidade autenticada. Os dados são locais ao navegador/origem e não sincronizam entre dispositivos. Persistência em JSON e validação completa são adequadas ao cenário limitado, não a grandes volumes ou sistemas multiusuário de produção.

Evoluções futuras devem preservar contratos, migrações explícitas e autorização por organização; integração REST requer autorização real e transações no servidor. Recomendações determinísticas e estimativas não são garantias comerciais ou financeiras.


## Sprint 4A — Logística Colaborativa

A rota `/producer/logistics` organiza entregas próprias, sugere cargas compatíveis entre produtores e compara frete individual/compartilhado com parâmetros explícitos. O mapa operacional React Leaflet é carregado sob demanda, com atribuição OpenStreetMap e fallback independente dos formulários. Não há GPS ou roteirização rodoviária real.

O schema local migra da versão 1 para 2 preservando dados comerciais e mantendo os bytes anteriores em `safraviva-domain.migration-v1`. Destinos não são preenchidos automaticamente. Complete origem, destino e janela nos painéis de entrega; confirme pedidos pendentes pelo módulo comercial antes de organizar transporte. Pedidos já vinculados aparecem em Transportes em Andamento.

Para uma demonstração integrada sem substituir o QA, abra “Cenário logístico de referência” e confirme a importação aditiva de registros sintéticos. Sugestões entre produtores são não contratadas; cada produtor só pode registrar transporte para seus próprios pedidos. Início do transporte e entrega continuam exigindo ações do prestador nos serviços existentes, sem terceiro ambiente de usuário.

Consulte [a documentação técnica da logística](docs/collaborative-logistics.md) para contratos, migração, fórmulas, limites, cenário e políticas do mapa. Execute `npm test -- --run`, `npm run lint` e `npm run build` para validação completa. A Sprint 4B não está implementada.
