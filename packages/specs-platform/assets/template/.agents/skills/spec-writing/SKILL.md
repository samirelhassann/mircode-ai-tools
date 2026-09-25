---
name: spec-writing
description: Como escrever e manter as specs de `.specs/specs/` — estrutura fixa da página de tarefa (contexto, visão técnica com diagrama Mermaid e blocos expansíveis, escopo, code review checklist), o `overview.md` de cada feature, o frontmatter, o `meta.json`, o registro de Execuções e as heurísticas de quebra em tasks. Carregue antes de criar, refinar ou atualizar qualquer arquivo em `.specs/specs/`.
related-skills: requirements-closure, test-strategy
---

# Escrita de specs

As specs vivem em `.specs/specs/<slug-da-feature>/` e são renderizadas pela Specs Platform
(`specs start`). A estrutura de diretório, a nomenclatura de arquivos e o `meta.json` estão em
`.specs/specs/CLAUDE.md` — esta skill cobre **o que escrever dentro dos arquivos**.

## Estrutura fixa da página de tarefa

Toda tarefa segue esta ordem de seções, sem exceção:

```
## Contexto da alteração          (termina com a lista "**Depende de:**")
## Visão Técnica
   diagrama Mermaid + legenda
   ### O que muda, em resumo      (tabela curta)
   ### Detalhamento técnico       (blocos <details>)
## Escopo
   ### Fora de escopo
## Code Review Checklist
```

**Não existem** as seções `Critérios de Aceite`, `Detalhes Técnicos`, `Testes` e `Dependências`
como seções de primeiro nível. Os critérios e os detalhes vivem dentro dos blocos expansíveis,
testes são um bloco expansível, e as dependências são a lista `**Depende de:**` no fim do
Contexto.

**Nunca escreva `# Título` no corpo.** O `title` do frontmatter já vira o `<h1>` da página; um H1
no corpo duplica o título (o renderer descarta o duplicado, mas o arquivo fica sujo).

### Contexto da alteração

Dois a quatro parágrafos curtos respondendo: como funciona hoje, o que passa a funcionar
diferente, e o que o usuário percebe (ou explicitamente não percebe). Sem detalhe de
implementação — isso é o detalhamento técnico.

Termina com:

```markdown
**Depende de:**

- [Título da task](./feat-<slug>-<task>.md) — o que ela entrega para esta
```

Quando não há dependência, diga isso explicitamente ("Nenhuma task. É a primeira da feature.").

### Diagrama da Visão Técnica (obrigatório)

Um `flowchart` Mermaid com a visão geral do que será feito. Sempre com estes `classDef`:

```
  classDef changed fill:#3b2f00,stroke:#eab308,color:#fde68a
  classDef added fill:#052e1a,stroke:#22c55e,color:#bbf7d0
  classDef removed fill:#3b0d0d,stroke:#ef4444,color:#fecaca
  classDef untouched fill:#151515,stroke:#2a2a2a,color:#9ca3af
```

Regras:

- **Um nó por recurso/componente real tocado** — use case, entidade, tabela, endpoint, job, fila,
  tela, componente, DAL, integração externa. Nada genérico como "o backend".
- **Cor pela natureza da mudança:** `:::changed` (amarelo) alterado, `:::added` (verde)
  adicionado, `:::removed` (vermelho) removido, `:::untouched` (cinza) só o contexto mínimo que
  faz o fluxo ter sentido.
- Cole a legenda logo abaixo do bloco:
  `> 🟡 alterado · 🟢 adicionado · 🔴 removido · ⚪ inalterado (contexto)`
- Agrupe em `subgraph` por etapa ou camada. Prefira `flowchart TB` com `direction LR` **dentro**
  de cada subgraph: faixas horizontais empilhadas rendem um diagrama equilibrado, enquanto `LR`
  puro produz diagramas larguíssimos e ilegíveis.
- Ligue arestas a **nós específicos**, nunca ao subgraph inteiro — aresta apontando para um
  subgraph faz o Mermaid ignorar o `direction` interno dele.
- Máximo ~15 nós. O que não couber vira texto no detalhamento.
- Sem aspas duplas dentro do rótulo; `<br/>` para quebrar linha.
- Um card `:::removed` pode marcar **acoplamento proibido** em vez de código deletado (ex.: "o que
  não pode passar a depender deste campo") — quando fizer isso, explique na linha da legenda.

### Blocos expansíveis do detalhamento técnico

A linha em branco depois do `</summary>` e antes do `</details>` é obrigatória — sem ela o
markdown interno não é interpretado:

```markdown
<details>
<summary>Título do recorte</summary>

Explicação curta do recorte.

- [ ] critério de aceite verificável

</details>
```

Regras:

- Um bloco por **recorte coeso**: etapa do fluxo, endpoint, seção de tela, política de erro.
- **Os critérios de aceite moram dentro do bloco do recorte a que pertencem**, logo abaixo da
  explicação.
- Blocos temáticos obrigatórios quando se aplicarem: `Segurança e sanitização de inputs`,
  `Premissas e questões em aberto`, `Testes` e, em frontend, `Responsividade`,
  `Estados de UI — loading, erro, vazio`, `Acessibilidade e animações`.
- **`Premissas e questões em aberto` é obrigatório em toda task média ou grande** — é onde a
  ambiguidade que não foi resolvida com o usuário fica registrada com default e racional, em vez
  de sumir. Formato e regra na skill `requirements-closure`.
- **`Testes` declara `**Tipo:**` e `**Gate:**`** com o comando real do pacote tocado. Formato e
  matriz de cobertura na skill `test-strategy`.
- **Nada de headings markdown (`###`) dentro de `<details>`** — eles aparecem no índice lateral
  apontando para conteúdo fechado. Use **negrito** para subtítulos internos.
- O conteúdo fora dos blocos precisa ser lido de ponta a ponta em menos de um minuto: contexto,
  diagrama, tabela-resumo, escopo e checklist. Todo o resto fica colapsado.

### Tabela "O que muda, em resumo"

Três colunas — `#`, `Mudança`, `Efeito`. Uma linha por mudança relevante, tipicamente 4 a 8.
O efeito é a consequência prática ("o worker deixa de ficar bloqueado"), não a repetição da
mudança.

## A `## Code Review Checklist`

É **a casa dos itens de estrutura interna** — não um resumo dos critérios de aceite.

A divisão, cuja regra completa está na skill `requirements-closure`:

- **Bloco `<details>`** → comportamento observável na fronteira. Vira teste, e o Verifier cobra
  `file:line` + asserção para cada um.
- **Code Review Checklist** → o que só se verifica abrindo o arquivo: path e nomenclatura, nome de
  DTO/tipo, padrão aplicado (`.strict()`, `private readonly`, allowlist de enum), ausência
  deliberada (sem índice novo, sem setter, sem backfill), acoplamento que não pode nascer.

O teste para saber onde cada item mora: **se eu refatorar sem mudar comportamento, isso quebra?**
Sim ⇒ Code Review Checklist.

**Não repita.** Se um item já é critério de aceite num bloco, ele não volta aqui condensado — é
duplicação que envelhece em dois lugares ao mesmo tempo. A checklist cobre o que os critérios
deliberadamente **não** cobrem.

Escreva cada item como algo que o revisor consegue marcar olhando o diff, e específico:
`Enum validado por allowlist no schema .strict() do controller`, não `Validação OK`.

## O `overview.md` da feature

Toda feature tem `.specs/specs/<slug>/overview.md` — a página exibida ao clicar na feature na
sidebar. Sem ele, a plataforma redireciona para a primeira task.

```
---
title: "<Título da feature, igual ao meta.json>"
description: "<mesma descrição do meta.json>"
---

## O que será feito          (problema, decisão e desenho geral — 3 a 5 parágrafos curtos)
## Visão Técnica
   diagrama Mermaid MACRO + legenda
   ### Frentes de trabalho             (tabela: frente · o que entrega · nº de tasks)
   ### Ordem de execução               (cadeia crítica e o que roda em paralelo)
```

- Sem `status` no frontmatter e **fora** de `pages` no `meta.json` — não é uma task.
- A lista de tasks com status é renderizada automaticamente abaixo do conteúdo. **Não escreva
  essa lista à mão.**
- O diagrama do overview é **macro** (granularidade de frente/entrega); o de cada task é **micro**
  (granularidade de arquivo/componente). Mesmas cores nos dois.
- Obrigatório ao criar feature nova. Ao adicionar uma task a uma feature existente, atualize o
  overview se a task mudar o desenho macro.

## Frontmatter da tarefa

```yaml
---
title: "<Camada/Descrição da tarefa>"
description: "<Frase curta descrevendo o escopo>"
status: pending        # pending | in-progress | completed | blocked
---
```

**O `title` descreve só a tarefa, sem repetir o nome da feature.** A plataforma já exibe a feature
como sobretítulo acima do H1 e agrupa as tarefas por feature na sidebar — repetir o prefixo
("Login — Frontend" dentro da feature "Login") gasta a linha inteira com informação redundante.
Escreva `"Frontend (tela de login)"`, não `"Login — Frontend (tela de login)"`. Em specs antigas
que ainda carregam o prefixo, o renderer o remove na exibição.

O `status` é responsabilidade de quem executa (`feature-runner`), não de quem refina.

## Critérios de aceite — como redigir

**A notação é EARS e a fonte de verdade é a skill `requirements-closure`** — carregue-a antes de
redigir. Em resumo: todo critério resolve para um dos seis padrões (ubíquo, `QUANDO`, `ENQUANTO`,
`ONDE`, `SE`, composto) e carrega o verbo **DEVE**.

```markdown
- [ ] **CADASTRO-03** — QUANDO o usuário submete CPF já cadastrado ENTÃO o sistema DEVE responder
      409 com `errorCode: CPF_ALREADY_REGISTERED` e não criar registro em `users`
```

O prefixo `**CATEGORIA-NN**` é o **ID de requisito**, obrigatório em task com 5+ critérios ou 2+
camadas — é ele que permite ao Verifier dizer "CADASTRO-03 coberto em `auth-use-cases.test.ts:88`".

E ainda:

- **Objetivos:** não "funcionar bem", mas "retorna 200 com payload `{ id, name }` para input
  válido".
- **Testáveis:** um humano ou um E2E verifica sem ambiguidade.
- **Ancorados no código real:** cite rotas, componentes, arquivos e tipos que existem. Não invente
  — a menos que a task seja justamente criá-los, e aí seja explícito ("Criar endpoint `POST
  /api/v1/vehicles`").
- **Sem tokens visuais fixos** (cores hex, px, pesos de fonte): eles mudam no protótipo e a doc
  fica mentindo. Descreva estrutura e intenção; quem implementa extrai os valores do protótipo.

## Validação determinística antes de apresentar

Depois de escrever ou editar qualquer arquivo de task, rode:

```bash
node .agents/scripts/validate-spec.mjs .specs/specs/<slug>/feat-<slug>-<task>.md
```

Ele checa por código o que esta skill exige de memória: frontmatter, ordem das seções, ausência de
H1 no corpo, `**Depende de:**`, `### Fora de escopo`, os quatro `classDef` do Mermaid, linha em
branco nos `<details>`, heading proibido dentro de `<details>`, critério fora de EARS, ID de
requisito malformado, premissa com célula vazia e presença do arquivo em `pages` do `meta.json`.

**Saída ≠ 0 = pare e corrija** antes de apresentar a spec. Rode no arquivo que você tocou — `--all`
existe para inventário e hoje acusa as 225 specs no formato antigo, que não são escopo desta rodada.

## Registro de Execuções

Quem executa acrescenta, ao fim do arquivo, depois de um `---`. **Cada execução é um bloco
expansível** — o histórico cresce sem empurrar o conteúdo da spec para longe:

```markdown
## Execuções

<details>
<summary>dd/mm/aaaa HH:mm — TIPO</summary>

- <o que foi criado/alterado, citando arquivos e decisões não óbvias>

</details>
```

Entradas novas vão **no topo** da seção, logo abaixo do `## Execuções`. O `<summary>` carrega data,
hora e tipo (`FEAT`, `FIX`, `REFACTOR`, `CHORE`…) — nada de heading `###`. Máximo 8 bullets por
execução; específico sempre ("Criado `.../health-routes.ts` com rota `GET /health`", não
"adicionada rota").

## Heurísticas de quebra em tasks

Quebre quando: a atividade toca frontend **e** backend; passaria de ~15 critérios de aceite;
partes podem ser paralelizadas; uma parte está bloqueada e a outra não.

Não quebre quando: o escopo é pequeno e coeso; as tasks resultantes teriam menos de 3 critérios.

Posição no array `pages`: dependente depois da dependência; backend antes de frontend;
integração/E2E por último.
