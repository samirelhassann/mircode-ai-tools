# Specs Platform — instalada neste projeto

Este projeto usa a **Specs Platform** (`@mir-code/specs-platform`). Ela renderiza os diretórios `.specs/specs/`, `.specs/discoveries/` e `.specs/drawings/` com UI navegável, drag-and-drop, mudança de status e disparo de agents pelo browser.

A plataforma é **agnóstica a stack**: funciona em qualquer projeto (Node, Java, Python, Go, Rust, etc.). Ela roda a partir do pacote npm instalado na sua máquina — nada é copiado para dentro do projeto além do conteúdo e da configuração, e o `package.json` do projeto (se houver) não é tocado.

> **O que versionar:** `.specs/specs/`, `.specs/discoveries/`, `.specs/drawings/`, `.specs/config.json`, `.agents/` e `SPECS.md`. O estado local da máquina (`.specs/.jobs.json`, `.specs/.run/`) já é adicionado ao `.gitignore` pelo `specs install`.

## Instalar o CLI (uma vez por máquina)

```bash
npm i -g @mir-code/specs-platform   # só a Specs Platform — comando `specs`
# ou
npm i -g @mir-code/ai-tools         # todas as ferramentas — comando `mircode-ai` (menu interativo)
```

Sem instalar nada: `npx @mir-code/specs-platform <comando>`.

## Como rodar

Na raiz do seu projeto:

```bash
specs start
```

Sobe a **UI + API numa porta só** (`port` do `.specs/config.json`, default `:4321`) em background e abre o browser. Pid e log ficam em `.specs/.run/`.

```bash
specs status                  # está rodando? em qual URL?
specs stop                    # para a instância deste projeto
specs start -f                # foreground (Ctrl+C para parar)
specs start --no-open         # não abre o browser
specs start -p 5000           # outra porta (sobrescreve o config)
```

Com o `@mir-code/ai-tools`, os mesmos comandos ficam em `mircode-ai specs-platform <comando>`, ou no menu interativo de `mircode-ai`.

## Estrutura esperada no projeto

```
<project>/
├── .agents/                     # fonte única de agentes e skills
│   ├── project.md               # ← PREENCHA: a configuração deste projeto
│   ├── agents/                  # 5 launchers (feature-runner, refinement, refinement-runner,
│   │                            #   discovery-agent, drawing-agent)
│   ├── skills/                  # 14 skills (processo + conhecimento)
│   └── scripts/                 # validate-spec.mjs, check-commit.mjs
├── .claude/{agents,skills}      # symlinks → .agents/
├── .cursor/{agents,skills}      # symlinks → .agents/
├── .specs/
│   ├── config.json              # config da plataforma
│   ├── discoveries/             # ← SUAS discoveries (RFC, spike, ADR, note)
│   │   ├── meta.json            # ordem na sidebar
│   │   └── <slug>.md
│   ├── drawings/                # ← SEUS desenhos (só o diagrama Mermaid)
│   │   ├── meta.json            # ordem na sidebar
│   │   └── <slug>.md
│   └── specs/                   # ← SUAS specs (features + tasks)
│       ├── meta.json            # ordem das features
│       ├── _templates/          # scaffolds de task (backend, frontend, integração)
│       └── <slug-da-feature>/
│           ├── meta.json
│           └── feat-<slug>-<task>.md
├── SPECS.md
└── ...
```

## Configuração

`.specs/config.json` controla:

| Chave | Default | Descrição |
|---|---|---|
| `port` | `4321` | Porta do servidor Fastify. |
| `warnBelowWidth` | `1024` | Largura mínima para a UI sugerir desktop-only. |
| `featuresDir` | `.specs/specs` | Diretório lido pelo servidor (relativo à raiz do projeto). |
| `agent.openTerminal` | `osascript` (macOS) | Terminal que abre o agent. Opções: `gnome-terminal`, `kitty`, `wezterm`, `none`. |
| `agent.cli` | `claude` | CLI padrão ao abrir os modais de execução (chave de `agent.commands`). A última escolha é lembrada por sessão (`localStorage`). |
| `agent.commands` | `{ claude, cursor }` | Comando **por CLI**. Chave = id da CLI (`claude`, `cursor`, ...); valor = comando disparado, com `{prompt}`, o placeholder opcional `{model}` (`--model <id>` ou vazio) e o token `feature-runner` (trocado pelo agent). O Cursor lê `.claude/agents/`, então os mesmos agents valem nas duas CLIs. |
| `agent.modelsCommand` | `{ cursor: "cursor-agent --list-models" }` | Comando que lista modelos **dinamicamente** por CLI (saída parseada no formato `id - Nome`). |
| `agent.models` | `{ claude: [opus, sonnet, haiku, fable] }` | Lista **estática** de modelos por CLI — fallback ou única fonte (Claude Code não expõe listagem; usa aliases `--model`). |
| `agent.command` | (derivado) | Legado/fallback (= `commands[cli]`). Configs antigas que só tinham `command` continuam funcionando. |
| `agent.scopes` | 3 templates | Prompts para `feature`, `featureNoPause`, `task`. |
| `prototype` | `null` | Protótipo do projeto. `tool`: `claude-design` (canvas por `url`) ou `pencil` (arquivo `.pen` por `file`). Opcionais: `title`, `designDir`, `artboards`, `nodeIds`, `openCommand`, `snapshot`. O `meta.json` de uma feature pode declarar o seu e substituir este. |

### Protótipo

Com `prototype` declarado, a navegação lateral ganha a seção **Protótipo**, que abre `/prototype`:
o protótipo renderizado dentro do app, em iframe, sem trocar de aba.

O canvas publicado recusa embed cross-origin (`frame-ancestors 'self'`), então o iframe carrega o
**snapshot local** — o HTML do canvas salvo em `snapshot` (default `<designDir>/canvas.html`) e
servido pelo Fastify. O botão **Sincronizar** dispara um job que relê o canvas e regrava esse
arquivo; sem snapshot, a página explica como gerar o primeiro.

As páginas de feature e de task ganham o painel **Protótipo**:

- **Ver aqui** — abre a página com o iframe. **Editar no canvas** abre o canvas real em outra aba;
  no Pencil, **Abrir no Pencil** abre o `.pen` no app local pelo `openCommand` (default
  `open -a Pencil {file}`).
- **Pedir alteração** — texto livre que vira um job como qualquer execução de agent, com terminal ao
  vivo. O prompt sai conforme a ferramenta: `/design ...` no Claude Design; instrução de editar pelo
  **Pencil MCP**, devolvendo os node IDs afetados, no Pencil.

Os agents fazem o mesmo caminho pela skill `prototype-check`: identificam a ferramenta antes e só
então aplicam as verificações dela. Sem `prototype`, o painel some e os agents pulam a fase visual.

## Agents configurados

| Agent | O que faz |
|---|---|
| **`refinement`** | Transforma descrição vaga em task/feature documentada em `.specs/specs/`. |
| **`refinement-runner`** | Refina em memória, esgota as dúvidas, implementa e para antes do commit — **sem** criar documento em `.specs/specs/`. |
| **`feature-runner`** | Executa uma task/feature, para antes do commit para code review. |

A operação da plataforma (subir, parar, atualizar) não depende de agents — use o CLI `specs` diretamente. Veja a seção [Troubleshooting](#troubleshooting) abaixo.

### Escolha da CLI (Claude Code / Cursor)

O medidor **Uso do plano** no rodapé das Execuções lê a fonte local mais recente. Para ele funcionar sem depender do app desktop do Claude, plugue o coletor no seu `statusLine` (`~/.claude/settings.json`). O comando abaixo imprime o trecho pronto, com o caminho do script dentro do pacote instalado:

```bash
specs statusline
```

Ele grava `rate_limits` em `~/.claude/specs-usage.json` a cada turno do Claude Code e repassa o JSON ao seu statusLine original. Requer `jq`.

As execuções aparecem na sidebar da direita, etiquetadas pela origem (`Spec`, `Refino`, `Discovery`, `Desenho`, `Protótipo`) e sobrevivem a um restart da plataforma — o histórico fica em `.specs/.jobs.json` (local, não versionado). Um job que estava vivo quando a plataforma caiu reaparece como `Cancelado · sessão anterior`: dá para reler o terminal, não para responder nele.

Cada disparo de agent (Rodar Tarefa, Refinamento, Discovery, Desenho, Editar via IA) tem um seletor **Ferramenta** para escolher entre **Claude Code** (`claude --agent ...`) e **Cursor** (`cursor-agent ...`). As opções vêm das chaves de `agent.commands`. Para Cursor, instale e autentique o `cursor-agent` (`curl https://cursor.com/install -fsS | bash`).

Abaixo há um seletor **Modelo** populado automaticamente (lembrado por sessão, por CLI): o Cursor lista dinamicamente via `cursor-agent --list-models`; o Claude Code usa os aliases de `agent.models.claude` (`opus`/`sonnet`/`haiku`/`fable`), pois o CLI não tem comando de listagem. A opção "Padrão da CLI" não passa `--model`. O modelo é injetado no `{model}` do comando.

## Atualizar

```bash
mircode-ai update                         # atualiza o CLI (ou: npm i -g @mir-code/specs-platform@latest)
specs install                             # atualiza agents/skills do projeto
```

O `specs install` é idempotente: regrava `.agents/agents/`, `.agents/skills/` e `.agents/scripts/` (skills que você adicionou por conta própria sobrevivem) e **preserva** `.agents/project.md`, `.specs/config.json`, seus `meta.json`, `_templates/` e este `SPECS.md`. `specs install --force` sobrescreve também esses arquivos.

## Troubleshooting

### A UI não carrega / ficou em skeleton

```bash
specs status                                    # a instância está viva?
curl -sf http://localhost:4321/health           # esperado: {"ok":true}
tail -50 .specs/.run/specs.log                  # erro na subida?
```

Se não está rodando, `specs start`. Para ver o erro direto no terminal: `specs start -f`.

### "Port already in use"

Outra instância (deste ou de outro projeto) está na mesma porta. Pare-a com `specs stop` no projeto dela, ou suba esta em outra porta: `specs start -p 4322` (ou mude `port` no `.specs/config.json`). Para achar o processo: `lsof -i :4321`.

### Veio de uma instalação antiga (`.specs/app/`, `specs:run`, `specs:apply`)

O runtime copiado para `.specs/app/` e os scripts/abbrs fish foram substituídos pelo CLI `specs`. Rode `specs install --clean-legacy` para remover o `.specs/app/` e remova as abbrs `specs:*` do seu `config.fish`. Se o seu `SPECS.md` ainda fala de `.specs/app/`, apague-o e rode `specs install` para regenerar.

### Botão "Rodar Tarefa" não dispara o agent

Conferir `agent.openTerminal` em `.specs/config.json`:

- **macOS default:** `"osascript"`. Teste manual:
  ```bash
  osascript -e 'tell application "Terminal" to do script "echo ok"'
  ```
  Se der erro de permissão: `System Settings → Privacy & Security → Automation` e autorize Terminal/Claude para Terminal.app.

- **Linux:** `"gnome-terminal"` / `"kitty"` / `"wezterm"` (conforme sua DE).

- **`"none"`:** botão desabilitado; a UI mostra toast explicativo.

O prompt enviado ao agent vem de `agent.scopes.<scope>` com placeholders `{feature}`, `{task}`, `{featureTitle}`, `{featurePath}` substituídos. Se o agent `feature-runner` não existir em `.claude/agents/`, a chamada falha silenciosamente.

### Mudar a porta do Fastify

Edite `.specs/config.json`:

```json
{
  "port": 5000,
  ...
}
```

Reinicie com `specs stop && specs start`.

### "Specs Platform completamente quebrada — nada funciona"

Sequência de diagnóstico:

1. CLI OK? `specs --version` (reinstale com `npm i -g @mir-code/specs-platform@latest`)
2. Config OK? `cat .specs/config.json | python3 -m json.tool`
3. Specs dir OK? `ls .specs/specs/meta.json`
4. Porta livre? `lsof -i :4321`
5. Erro na subida? `specs start -f`

Se tudo acima está ok e ainda não sobe: `specs install --force` reinstala do zero (atenção: sobrescreve `.specs/config.json` e `.agents/project.md`).

## Desinstalar

```bash
specs stop
rm -rf .specs/.run .specs/.jobs.json .specs/config.json
npm rm -g @mir-code/specs-platform
# .agents/ e os symlinks .claude//.cursor/ podem ficar — os agents funcionam sem a UI.
# .specs/specs/ também permanece — é seu conteúdo.
```
