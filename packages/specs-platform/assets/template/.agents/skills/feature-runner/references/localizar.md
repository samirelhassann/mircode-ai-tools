# Localizar a task e carregar contexto

## 1. Casar a entrada com uma `(feature, task)`

`Glob` em `.specs/specs/*/meta.json`, leia os `meta.json` e case a entrada do usuário — ela pode vir
como slug, título, nome de arquivo ou descrição livre.

| Situação | O que fazer |
|---|---|
| Entrada identifica a feature **e** o usuário pediu a feature inteira | modo feature, a partir da primeira `pending` |
| Entrada identifica só a feature e não está claro | `AskUserQuestion` listando as tasks na ordem de `pages` com o status de cada uma |
| Ambiguidade entre features | `AskUserQuestion` |
| Task já `completed` | **pare e pergunte** se a re-execução é intencional |

## 2. Carregar contexto

Em paralelo:

- `CLAUDE.md` da raiz e `.specs/specs/CLAUDE.md`;
- `meta.json` e `overview.md` da feature;
- o arquivo da task;
- as demais tasks da feature (dependências cruzadas);
- tudo que a lista `**Depende de:**` linkar;
- **`.specs/STATE.md`, seção `## Decisions`** — toda entrada `AD-NNN` com `Status: active` é
  restrição de projeto que esta implementação precisa respeitar. Conflito com o que a task pede?
  **pare e pergunte** antes de decidir: conformar ou propor supersessão.

`PRD.md` / `SDD.md` só se a task for de design ou arquitetura.

## 3. Procurar o que já existe

Antes de escrever código novo, `Grep`/`Glob` nos diretórios de reuso do `project.md`:
os pacotes compartilhados e o código das apps (a estrutura está no `project.md`).
**Reuso vem antes de criação** — utilitário, tipo, componente,
hook.

Escopo amplo demais para `Glob`/`Grep`: no máximo **1** `Agent` com `subagent_type: Explore`, com
foco específico.

## 4. Cadeia de verificação de conhecimento

Decisão que depende de versão de lib (o `project.md` lista as que mais mudam decisão): consulte a doc
atual via sub-agente com MCP `context7` **antes** de implementar. Não confie na memória — a skill
`requirements-closure` tem a cadeia completa (código → docs → context7 → web → declarar incerteza).

**Nunca fabrique** API, campo ou comportamento. Não achou? diga "não sei" e pergunte.
