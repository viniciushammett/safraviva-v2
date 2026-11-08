# Hotfix do mapa operacional — 2026-11-08

## Evidências e diagnóstico

A consulta HTTP à página pública
`https://orange-bay-01006dc10.4.azurestaticapps.net/`, em
2026-11-08 03:09:33 UTC, retornou `HTTP/2 200` com:

```text
referrer-policy: same-origin
cache-control: public, must-revalidate, max-age=30
```

`same-origin` suprime o `Referer` das imagens solicitadas a
`tile.openstreetmap.org`, pois esse domínio é diferente da aplicação. O
TileLayer existente não definia uma política própria. Essa incompatibilidade
com a política do OSM foi confirmada; não foi possível confirmar se existe
também algum bloqueio por IP, navegador ou extensão do usuário.

A URL já era o endpoint oficial HTTPS e a atribuição estava presente. Não
foram encontrados `no-referrer`, interceptação por service worker,
cache-busting, cabeçalhos que desabilitem cache ou download em massa. O mapa
já era opcional, carregado após ação do usuário. O cabeçalho de cache acima
pertence ao HTML do Azure, não aos tiles externos.

O Chromium disponível não iniciou por ausência de bibliotecas do sistema
(`libnspr4.so`, entre outras). A inspeção de produção foi feita com HTTP;
não houve captura de rede de um navegador real nem solicitação automatizada
de tiles ao OSM para varrer ou aquecer o mapa.

## Correção

- A política `strict-origin-when-cross-origin` é aplicada somente às imagens
  da camada, pela opção documentada `referrerPolicy` do Leaflet 1.9.4.
  O navegador envia a origem real da aplicação; não há identificação forjada.
- A URL, atribuição e política estão reunidas em `map-tiles.ts` para facilitar
  uma eventual substituição revisada do provedor. O provedor continua sendo
  o OSM; não foi necessário avaliar ou contratar uma alternativa.
- O cache HTTP permanece sob controle do navegador e do provedor, sem
  parâmetros aleatórios, `fetch` adicional, proxies ou mudanças de cabeçalhos.
- `updateWhenIdle`, `updateWhenZooming={false}` e `keepBuffer={1}` limitam as
  atualizações durante a interação, sem pré-carregamento de regiões ou zooms.
- Cada tile permanece oculto até a leitura dos pixels da própria imagem já
  carregada e sua verificação SHA-256. As assinaturas dos dois PNGs oficiais
  de bloqueio (403 e 403r) também reconhecem essas imagens se vierem com HTTP
  200. A verificação não usa OCR, cores aproximadas ou comparação entre tiles,
  evitando classificar áreas uniformes do mapa como bloqueio.
- `crossOrigin="anonymous"` permite ler os pixels quando o servidor autoriza
  CORS. Falhas HTTP/CORS, imagens inválidas ou impossibilidade de verificar
  pixels removem a camada. Marcadores, conexões, seleção, zoom e movimentação
  permanecem disponíveis. A atribuição permanente no MapPanel continua visível.
- A nova tentativa é exclusivamente manual, sem timers de repetição. O botão
  de ocultar a base também permite remover imagens de erro não reconhecidas.

Não foram alterados `index.html`, `staticwebapp.config.json`, dependências,
infraestrutura, serviços de negócio, persistência ou migrações.

## Validação e limites

O estado inicial foi validado com os 372 testes existentes. Os novos testes
cobrem configuração, atribuição, política por imagem, validação das imagens
oficiais, falhas de rede/validação, nova tentativa manual, eventos atrasados,
seleção, zoom e movimentação com Leaflet real e salvamento de entrega com o
mapa indisponível. Os testes não acessam servidores de tiles.

Resultados da validação local:

| Verificação | Resultado |
| --- | --- |
| `npm test -- --reporter=dot` | 386 testes aprovados em 21 arquivos (14 a mais que a referência) |
| `npm run lint` | Aprovado, sem erros ou avisos |
| `npx tsc -b` | Aprovado |
| `npm run build` | Aprovado |
| `git diff --check` | Aprovado |

O build emitiu avisos sobre comentários de Zod, mistura de importação estática
e dinâmica do domain-store e chunks acima de 500 kB; nenhum impediu a geração.

As assinaturas reconhecem as duas imagens oficiais consultadas nesta data.
Uma futura alteração visual da mensagem de bloqueio servida com HTTP 200 e
CORS válido exige atualização das assinaturas; nesse caso há ocultação manual.
O navegador precisa permitir Canvas e Web Crypto (HTTPS ou localhost); caso
contrário, a base fica indisponível e o fluxo logístico continua funcional.

Após publicar o hotfix pelo fluxo habitual, validar em navegador: abrir
Logística, carregar o mapa e verificar `Referer` com a origem real do Azure,
tiles cartográficos, atribuição, zoom, movimentação e seleção. Um bloqueio
persistente após essa validação precisa de investigação adicional; não deve
ser contornado por proxies ou troca de identidade. Não houve deploy, commit
ou push durante a correção.

## Fontes consultadas

- [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [OSM Blocked tiles](https://wiki.openstreetmap.org/wiki/Blocked_tiles)
- [Leaflet 1.9.4 — TileLayer](https://leafletjs.com/reference-1.9.4.html#tilelayer)
- [React Leaflet 5 — props e eventos](https://react-leaflet.js.org/docs/api-components/)
- [Imagem oficial 403](https://wiki.openstreetmap.org/wiki/File:403_tile.png)
- [Imagem oficial 403r](https://wiki.openstreetmap.org/wiki/File:403r_tile.png)
