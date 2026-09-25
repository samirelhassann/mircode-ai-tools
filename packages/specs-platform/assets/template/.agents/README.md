# Agentes e skills (fonte única)

Este diretório é a **fonte de verdade** dos subagentes e skills do projeto. Claude Code e Cursor leem
os mesmos arquivos via symlinks, criados pelo instalador da Specs Platform:

```
.agents/
├── agents/     ← launchers de 15 linhas          → .claude/agents, .cursor/agents
├── skills/     ← todo o conteúdo (processo + conhecimento) → .claude/skills, .cursor/skills
├── scripts/    ← validadores determinísticos     (fora de qualquer symlink)
├── project.md  ← configuração deste projeto      (fora de qualquer symlink)
├── README.md   ← este arquivo                    (fora de qualquer symlink)
└── RUNTIME.md  ← mapa de tools Claude Code ↔ Cursor (fora de qualquer symlink)
```

| Consumidor | Agentes | Skills |
|---|---|---|
| Claude Code | `.claude/agents/` → `.agents/agents/` | `.claude/skills/` → `.agents/skills/` |
| Cursor | `.cursor/agents/` → `.agents/agents/` | `.cursor/skills/` → `.agents/skills/` |

> **Por que `agents/` e `skills/` são irmãs, e não aninhadas.** Claude Code e Cursor varrem o
> diretório de agentes **recursivamente** e registram todo `.md` com frontmatter `name` +
> `description` como subagente. Se os symlinks apontassem para `.agents/` inteira, as skills
> apareceriam **também** na lista de subagentes: descrições duplicadas no system prompt de toda
> sessão e risco de delegar `subagent_type: test-strategy` em vez de carregar a skill. Não mova
> `skills/` para dentro de `agents/`, nem reaponte os symlinks para a raiz de `.agents/`.

## Primeiro passo depois de instalar: preencher `project.md`

As skills são **agnósticas ao projeto** — contêm método, não valores. Elas não sabem a stack, os
caminhos dos pacotes, os comandos de teste, a biblioteca de UI nem a ferramenta de protótipo.

Tudo isso vive em **`project.md`**, que chega como formulário em branco. Enquanto um campo estiver
`<preencher>`, a skill que depende dele **para e pergunta** em vez de adivinhar. Campo que não se
aplica: escreva `n/a`.

| Seção de `project.md` | Consumida por |
|---|---|
| Identidade · Stack | `feature-runner`, `refinement` |
| Pacotes, testes e comandos | `test-strategy` (matriz de cobertura e comandos de gate) |
| Convenções de código | `execution-protocol`, `feature-runner` |
| Design e UI | `ui-standards` (skill opcional) |
| Segurança de inputs | `input-security` (skill opcional) |
| Ferramentas visuais | `prototype-check` |
| Documentação e processo | `spec-writing`, `discovery-writing`, `drawing-writing` |
| Scratch e temporários | `verification` (prefixo do worktree descartável) |

Ajuste também `CODE_EXTENSIONS` em `scripts/validate-spec.mjs`, se a stack usar outras extensões.

## O conteúdo vive nas skills; o agente é só um launcher

Cada arquivo de `agents/` tem 15 linhas: frontmatter (`name`, `description`, `tools`) e uma frase
mandando carregar a skill de mesmo nome. **Nenhuma regra é duplicada ali.**

Isso entrega três coisas ao mesmo tempo:

- **Divulgação progressiva.** O `SKILL.md` de uma skill de processo traz princípios e o mapa de
  fases; o detalhe de cada fase mora em `references/`, lido só quando a fase começa.
- **Contexto isolado quando importa.** Delegar via `Agent` / `Task` com `subagent_type` continua
  funcionando e continua nascendo com contexto limpo.
- **Invocação direta quando não importa.** `/feature-runner` (Claude Code) ou ler o `SKILL.md`
  (Cursor) roda o mesmo processo sem subagente.

**Para mudar comportamento, edite a skill.** O arquivo do agente só muda se o `description` (que
governa a delegação proativa) ou a lista de `tools` mudar.

## As skills

### Processo — o que fazer, em que ordem

| Skill | Papel |
|---|---|
| `refinement` | descrição livre → spec documentada em `.specs/specs/` |
| `feature-runner` | spec → código, halt para code review humano |
| `refinement-runner` | descrição livre → código direto, sem escrever spec |
| `discovery-agent` | problema aberto → RFC/spike/ADR em `.specs/discoveries/` |
| `drawing-agent` | pedido de diagrama → desenho Mermaid em `.specs/drawings/` |
| `execution-protocol` | protocolo comum aos dois runners: princípios invioláveis, blast radius, git, halt, complete |

### Conhecimento — como fazer bem

| Skill | Cobre |
|---|---|
| `spec-writing` | formato da página de spec, diagrama Mermaid, blocos `<details>`, `overview.md`, frontmatter, registro de Execuções |
| `requirements-closure` | critérios de aceite em EARS, IDs de requisito, sweep das 9 dimensões implícitas, portão de fechamento |
| `test-strategy` | matriz de cobertura por camada, os três gates, co-location, Test Adequacy Review (A–D) |
| `verification` | Verifier independente, evidence-or-zero, sensor de discriminação em worktree descartável |
| `discovery-writing` | tipos (rfc/spike/adr/note), frontmatter, estrutura por tipo, `meta.json` |
| `drawing-writing` | formato do arquivo de desenho e o `meta.json` de `.specs/drawings/` |
| `mermaid-diagramming` | sintaxe e estética do Mermaid, checklist antes de gravar |
| `prototype-check` | identificar a ferramenta de protótipo e consultá-la antes de implementar |

### Skills opcionais, não incluídas

`ui-standards` (padrões de UI) e `input-security` (sanitização de inputs) são referenciadas pelas
skills de processo como **condicionais**: se o projeto as adotar, elas são carregadas; se não
existirem, o agente segue sem elas. Para adotá-las, copie-as de um projeto que já as tenha e
preencha as seções correspondentes de `project.md`.

## Gates determinísticos

O que é estrutural roda por código, não por memória:

```bash
node .agents/scripts/validate-spec.mjs .specs/specs/<slug>/feat-<slug>-<task>.md
node .agents/scripts/check-commit.mjs --message "feat(login): tela de login"
```

Saída ≠ 0 significa **pare e corrija**.

## Levar esta estrutura para outro projeto

A Specs Platform já faz isso: `specs install` instala `.agents/` e cria os symlinks. Manualmente:

1. Copie `.agents/` inteira.
2. Crie os symlinks: `.claude/agents` → `../.agents/agents`, `.claude/skills` → `../.agents/skills`,
   e o mesmo para `.cursor/`.
3. **Preencha `project.md`.** Nenhuma skill precisa ser tocada.

O que **não** é configurável, por ser o método em si: a estrutura `.specs/specs/`,
`.specs/discoveries/` e `.specs/drawings/`, o `.specs/STATE.md` com `AD-NNN`, o ciclo
halt → ajustar → complete, a notação EARS dos critérios de aceite e o Test Adequacy Review. Quem
adota estes agentes adota este processo — é o que eles são.
