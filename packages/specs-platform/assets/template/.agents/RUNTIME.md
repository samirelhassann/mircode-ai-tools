# Runtime: Claude Code e Cursor

Use este mapa quando um prompt citar uma tool ou fluxo de outro produto. O **comportamento** é o mesmo; muda só o nome da tool.

## Perguntas estruturadas ao usuário

| Claude Code | Cursor |
|---|---|
| `AskUserQuestion` | `AskQuestion` |

Sempre 2–4 opções concretas; marque "(Recomendado)" quando fizer sentido.

## Edição de arquivos

| Claude Code | Cursor |
|---|---|
| `Edit` | `StrReplace` (ou `Write` para arquivo novo) |
| `Write` | `Write` |
| `Read` | `Read` |
| `Glob` / `Grep` | `Glob` / `Grep` |
| `Bash` | `Shell` |

Prefira tools de arquivo em vez de `cat`/`grep`/`sed` no terminal.

## Subagentes

| Claude Code | Cursor |
|---|---|
| `Agent` com `subagent_type` | `Task` com `subagent_type` |

Exemplos: `feature-runner`, `refinement`, `refinement-runner`, `discovery-agent`, `drawing-agent`,
mais os genéricos do produto (`explore`, `generalPurpose`).

Para tools de protótipo e de E2E (normalmente indisponíveis no agente pai): delegue a um subagente
com o MCP correspondente, como descrito em `prototype-check`.

## Skills

| Claude Code | Cursor |
|---|---|
| `Skill` tool ou `/nome-da-skill` | Ler `.agents/skills/<nome>/SKILL.md` (ou symlink `.cursor/skills/`) |

Skills listadas no frontmatter do agente devem ser **lidas por completo** antes da fase que as exige.

### `references/` — divulgação progressiva

Uma skill de processo tem `SKILL.md` curto (princípios + mapa de fases) e arquivos em
`references/` com o detalhe de cada fase. **Carregue a referência no momento em que a fase começa,
e leia-a até o fim** — nunca aja sobre leitura parcial, e nunca pré-carregue todas.

Os caminhos em `references/` são relativos ao diretório da própria skill. Uma skill pode apontar
para a referência de outra (ex.: `refinement-runner` reusa
`../feature-runner/references/implementar.md`) — isso é deliberado e evita duplicar prosa que
precisaria ser mantida em dois lugares.

No Cursor, onde não há tool `Skill`, "carregar a skill X" significa **ler
`.agents/skills/X/SKILL.md` por completo** e depois suas `references/` conforme o mapa de fases.

## Frontmatter dos agentes (Cursor)

Campos extras (`tools`, `skills`) são para Claude Code; Cursor ignora sem quebrar. `model: inherit` faz o subagente usar o mesmo modelo do pai.

Os arquivos de `.agents/agents/` são **launchers de 15 linhas**: todo o comportamento mora na skill
de mesmo nome. Para mudar o que um agente faz, edite `.agents/skills/<nome>/`.
