---
name: drawing-writing
description: Como escrever e manter os desenhos de `.specs/drawings/` — os cinco tipos (architecture, flow, sequence, data, state), o frontmatter, a regra de "só o diagrama, sem prosa", e a atualização do `meta.json`. Carregue ao criar ou alterar qualquer arquivo em `.specs/drawings/`.
---

# Escrita de desenhos

Desenhos são a memória visual do projeto: arquitetura, fluxos, sequências, modelo de dados,
máquinas de estado. Moram em `.specs/drawings/<slug>.md`, **sem subpastas**.

A página de um desenho na Specs Platform **é o diagrama**: o canvas ocupa a tela inteira, com
arrasto e zoom, sem índice e sem corpo de markdown. Nada que você escrever fora do bloco
```mermaid aparece para o leitor — só no editor.

A sintaxe Mermaid — escolha do tipo de diagrama, layout, paleta, `classDef`, armadilhas de render
— está na skill `mermaid-diagramming`. Carregue as duas.

Um desenho **não altera código de produção**. O output é um `.md` + a entrada no `meta.json`.

## A regra que manda em tudo: só o diagrama

O arquivo é **frontmatter + um bloco ```mermaid**. Mais nada.

- **Sem `## Visão geral`, sem `## Notas`, sem `## Fontes`, sem parágrafo de introdução.** A página
  não renderiza nada disso.
- **Sem `# Título`** — o título vem do frontmatter e aparece na topbar.
- **A legenda vai dentro do diagrama**, como um nó (veja `mermaid-diagramming`). Uma linha de
  citação abaixo do bloco não seria exibida.
- **Tudo que você precisaria explicar em prosa vira rótulo.** Se o desenho só faz sentido com um
  parágrafo ao lado, o problema é o desenho: nomeie melhor os nós, rotule as arestas, corte o que
  não pertence ao recorte.
- Contexto, trade-offs e "por quês" que não cabem num rótulo **não pertencem a um desenho** —
  pertencem a uma discovery (`.specs/discoveries/`) ou à spec da task. Linke o desenho de lá.

Mais de um bloco ```mermaid no mesmo arquivo é permitido, e a página mostra uma faixa de abas —
use só quando forem **zooms diferentes da mesma pergunta** (panorama + detalhe). Perguntas
diferentes viram desenhos diferentes.

## Os cinco tipos

O `type` do frontmatter é a **pergunta que o desenho responde**, não o tipo de diagrama Mermaid
(um `architecture` costuma ser um `flowchart`).

| Tipo | Responde | Diagrama típico |
|---|---|---|
| `architecture` | Que peças existem e como se conectam? | `flowchart` com subgraphs |
| `flow` | Que caminho um pedido/dado percorre, com que desvios? | `flowchart` com decisões |
| `sequence` | Em que ordem, e quem espera por quem? | `sequenceDiagram` |
| `data` | Como os dados se relacionam? | `erDiagram` / `classDiagram` |
| `state` | Em que estados uma entidade vive e o que a move? | `stateDiagram-v2` |

Se o usuário não indicar o tipo, infira do pedido. Só pergunte quando genuinamente ambíguo.
**Não invente tipos novos** — a UI só conhece esses cinco e cai em `architecture` no resto.

## Nome do arquivo

`kebab-case`, começando com letra minúscula, descrevendo o **assunto**, não o formato:
`fan-out-sns-sqs`, `ciclo-vida-notificacao`, `retry-e-dlq`, `modelo-notifications`.

Não prefixe com o tipo (`arch-`, `seq-`): o badge da sidebar já mostra isso.

Se o slug já existir, **pergunte** se é para sobrescrever ou criar com sufixo.

## O arquivo, inteiro

````markdown
---
title: "Fan-out do SNS domain-events"
type: architecture
date: 2026-09-01
---

```mermaid
flowchart TB
  ...
```
````

`date` é a data de criação, ISO, sem hora. Não a atualize a cada edição — ela diz quando o desenho
nasceu, e a sidebar a usa como referência de idade.

## `meta.json`

Depois de gravar o arquivo:

1. Leia `.specs/drawings/meta.json`; se não existir, crie com
   `{ "title": "Desenhos", "pages": [] }`.
2. Acrescente o slug (sem `.md`) ao fim de `pages` — **sem duplicar** se já estiver lá.

A ordem de `pages` é a ordem da sidebar, e o usuário pode reordenar arrastando. Ao acrescentar um
desenho novo, sempre no fim: reordenar é decisão dele.

## Alterando um desenho existente

1. Leia o arquivo inteiro antes de mexer.
2. Preserve o que não foi pedido — título, tipo, `date`, os `classDef`, os outros diagramas.
3. Se a mudança acrescenta uma cor ou um tipo de seta, **atualize o nó de legenda** junto.
4. Se a mudança troca o `type`, o slug provavelmente também deveria mudar — pergunte.
5. Se o pedido é "explica isso aqui", não acrescente prosa ao arquivo: melhore os rótulos, ou
   proponha uma discovery.
