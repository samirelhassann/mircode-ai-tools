---
name: discovery-writing
description: Como escrever documentos de discovery em `.specs/discoveries/` — os quatro tipos (rfc, spike, adr, note), o frontmatter, a estrutura de cada tipo, as regras de conteúdo e a atualização do `meta.json`. Carregue ao criar ou revisar uma pesquisa, spike, RFC ou ADR.
---

# Escrita de discoveries

Discoveries são documentos exploratórios: pesquisa, comparação de alternativas, registro de
decisão. Moram em `.specs/discoveries/<slug>.md`, **sem subpastas**, e são renderizados pela Specs
Platform em seção própria (fora do fluxo de features/tasks).

Discovery **não altera código de produção**. O output é um `.md` + a entrada no `meta.json`.

## Os quatro tipos

| Tipo | Quando usar | Tom |
|---|---|---|
| `rfc` | Proposta de mudança que precisa de alinhamento antes de virar código (trocar gateway de pagamento, migrar ORM) | Formal: contexto, proposta, alternativas, trade-offs, plano de adoção |
| `spike` | Investigação técnica time-boxed para validar hipótese ("aguenta 10k req/s?") | Direto: hipótese, metodologia, resultados, decisão |
| `adr` | Registro de decisão arquitetural já tomada (imutável) | Conciso: status, contexto, decisão, consequências |
| `note` | Pesquisa ou briefing que não cabe nos anteriores | Flexível |

Se o usuário não indicar o tipo, infira. Só pergunte quando genuinamente ambíguo. **Não invente
tipos novos.**

## Nome do arquivo

`kebab-case`, começando com letra minúscula, descritivo:
`avaliacao-gateways-pagamento`, `spike-load-test-api`, `adr-orm-a-vs-b`.

Se o slug já existir, **pergunte** se é sobrescrita ou se cria com sufixo `-v2`.

## Frontmatter

```yaml
---
title: "Avaliação de gateways de pagamento"
type: rfc            # rfc | spike | adr | note
date: YYYY-MM-DD     # data de criação, ISO, sem hora
---
```

Não repita o título como `# Título` no corpo — o renderer já usa o `title` do frontmatter como H1.

## Estrutura por tipo

**RFC:** `## Contexto` · `## Proposta` · `## Alternativas consideradas` · `## Trade-offs` ·
`## Plano de adoção` · `## Questões em aberto`

**Spike:** `## Hipótese` · `## Metodologia` · `## Resultados` · `## Decisão / Próximos passos`

**ADR:** `## Status` (accepted | proposed | deprecated | superseded-by X) · `## Contexto` ·
`## Decisão` · `## Consequências`

**Note:** livre, com H2 nas seções principais.

## Regras de conteúdo

- **Nunca invente dados.** Se não sabe, pergunte ou declare "em aberto".
- **Decisão nunca implícita:** "decidimos X porque Y" ou "em aberto — precisa input de Z".
- **Tabelas comparativas** para alternativas: uma coluna por opção, uma linha por critério.
- **Links** para arquivos do projeto por path relativo à raiz
  (ex.: `apps/<app>/src/core/...`).
- **Código de exemplo** em bloco fenced com linguagem.
- **Diagramas** com Mermaid quando ajudarem a comparar arquiteturas — a plataforma renderiza e o
  diagrama abre em tela cheia com zoom.
- **Referencie discoveries anteriores** em vez de reescrevê-las.
- Tamanho típico: 200–1500 linhas. Maior que isso, quebre em discoveries linkadas.

## `meta.json`

Depois de gravar o arquivo:

1. Leia `.specs/discoveries/meta.json`; se não existir, crie com
   `{ "title": "Discoveries", "pages": [] }`.
2. Acrescente o slug (sem `.md`) ao fim de `pages` — **sem duplicar** se já estiver lá.
