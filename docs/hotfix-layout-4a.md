# Hotfix visual — Sprint 4A

## Causa confirmada

As tabelas usam legendas acessíveis `caption.sr-only`. O utilitário aplica `position: absolute`, mas o container de conteúdo não estabelecia um bloco de referência posicionado. O `offsetParent` das legendas era o `body`. As posições estáticas de tabelas abaixo da dobra ampliavam o overflow do documento, mesmo com o `main` tendo sua própria rolagem e o shell usando `overflow-hidden`. Isso criava uma barra externa adicional, que permitia rolar para uma faixa vazia depois do shell de altura `100dvh`.

A hipótese foi confirmada no Chromium antes de editar o código: apenas aplicar `position: relative` ao `main` mudou o offsetParent de BODY para MAIN e reduziu a altura do documento de 1659 px para 1080 px em uma janela de 1920×1080. Não foi necessário esconder globalmente o overflow do body, remover legendas acessíveis ou alterar os estilos globais.

Outros pontos de composição: o limite de largura de 1440 px deixava faixas laterais adicionais em monitores maiores; a margem superior do rodapé somava-se ao padding inferior do conteúdo; identificadores e células sem quebra alargavam as tabelas. A navegação não tinha limites explícitos de altura/rolagem próprios para janelas menores.

## Correções

- `main` posicionado, com mínimos flexíveis zerados e rolagem vertical contida. Header e sidebar continuam fora dessa rolagem, presos ao frame da aplicação, sem duplicar navegação ou mudar perfis.
- Conteúdo usa a largura disponível; rodapé acompanha o conteúdo longo e ocupa o final da área disponível nas páginas curtas, sem altura mínima artificial de módulo.
- Navegação com região central flexível e rolável quando necessário, mantendo cabeçalho e ações inferiores acessíveis.
- Tabelas da logística com quebra de descrições/datas e ações empilhadas. Scroll horizontal, quando necessário em telas pequenas, fica no wrapper da tabela, nunca no documento.
- Referências visuais determinísticas e compactas para pedidos/fretes. Não são novos IDs de domínio: seleção, URLs, comandos, keys e persistência continuam usando o identificador original. O original permanece disponível por title e nas seções de identificação técnica dos painéis.
- Pesquisa da logística aceita a referência visível e o identificador original. Critérios e rateio ficam em detalhes expansíveis. Custos, avisos de estimativa, dados sintéticos e restrições de autorização permanecem disponíveis.
- Mapa entre 256 e 384 px, adaptado à altura da janela, com container isolado. Mantém zoom/arraste e zoom por roda desativado para permitir a rolagem da página. Fallback não reserva uma área artificial de altura fixa.

Nenhum serviço, regra comercial, custo, migração ou mecanismo de persistência foi alterado pelo hotfix. Os arquivos da Sprint 4A já presentes no workspace foram preservados.

## Verificação no navegador

Chromium headless 147, perfil temporário isolado e cenário de referência local, sem tocar nos dados do navegador usado para QA. Driver via Chrome DevTools Protocol; sem novas dependências do projeto. As três bibliotecas de execução ausentes foram extraídas em `/tmp`, sem instalação no sistema.

| Medida | 1366×768 antes | 1366×768 depois | 1920×1080 antes | 1920×1080 depois |
| --- | --- | --- | --- | --- |
| Altura do documento | 1754 px | 768 px | 1659 px | 1080 px |
| Scroll vertical do conteúdo | MAIN + documento | MAIN | MAIN + documento | MAIN |
| Altura do mapa aberto | 384 px | 307,19 px | 384 px | 384 px |

Verificados com asserções no navegador:

- documento sem overflow vertical/horizontal nas duas resoluções;
- uma região de rolagem vertical de conteúdo, no MAIN;
- header e sidebar permanecem no topo após rolar até o fim;
- rodapé alcançável, com borda inferior alinhada ao viewport ao final da rolagem;
- tabelas de entregas e operações cabem nas duas larguras desktop;
- recolher/expandir sidebar preserva o layout;
- mapa abre, zoom e arraste respondem, roda sobre o mapa rola o conteúdo;
- falha de tiles forçada produz o aviso sem interromper a tela;
- navegação móvel em 390×844 abre/fecha e o documento não transborda.

Capturas e medições temporárias: `/tmp/safraviva-before-1366.png`, `/tmp/safraviva-before-1920.png`, `/tmp/safraviva-after-1366.png`, `/tmp/safraviva-after-1920.png`, `/tmp/safraviva-map-1366.png`, `/tmp/safraviva-map-1920.png` e `/tmp/safraviva-hotfix-qa-results.json`.

## Arquivos do hotfix

- `src/app/layouts/app-layout.tsx`
- `src/components/navigation/app-sidebar.tsx`
- `src/modules/logistics/page.tsx`
- `src/modules/logistics/delivery-form.tsx`
- `src/modules/logistics/transport-panel.tsx`
- `src/modules/logistics/cost-comparison.tsx`
- `src/modules/logistics/map-panel.tsx`
- `src/modules/logistics/operational-map.tsx`
- `src/modules/logistics/references.ts`
- `src/modules/logistics/references.test.ts`
- `src/modules/logistics/page.test.tsx`
- `src/modules/logistics/operational-map.test.tsx`
- `docs/hotfix-layout-4a.md`

A suíte contém 283 testes aprovados. Lint sem erros/avisos; TypeScript strict e build de produção aprovados. Permanecem os avisos anteriores do build sobre chunks e comentários de dependências. Não foi iniciada a Sprint 4B.
