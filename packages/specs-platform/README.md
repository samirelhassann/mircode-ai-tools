# @mir-code/specs-platform

Plataforma agnóstica de documentação de specs — lê `.specs/specs/` de qualquer projeto (Node, Java, Python, Go, etc.), renderiza em dark mode com drag-and-drop, status por modal e disparo de agents (Claude Code / Cursor) por um clique.

Faz parte do monorepo [`mircode-ai-tools`](../../README.md). Pode ser usado sozinho (comando `specs`) ou pelo CLI guarda-chuva [`@mir-code/ai-tools`](../ai-tools/README.md) (comando `mircode-ai specs-platform ...` ou menu interativo `mircode-ai`).

## Instalação (uma vez por máquina)

```bash
npm i -g @mir-code/specs-platform
```

Ou sem instalar: `npx @mir-code/specs-platform <comando>`.

O pacote traz o servidor e a UI já buildados. Nada de código da plataforma é copiado para o seu projeto e o `package.json` dele (se existir) não é tocado.

## Uso

### Primeira vez num projeto

Na raiz do projeto (qualquer stack):

```bash
specs install     # .agents/ + symlinks, .specs/, SPECS.md, .gitignore
specs start       # sobe UI + API em background (:4321) e abre o browser
```

O `specs install` grava no seu projeto:

- `.agents/` — **fonte única** de agentes e skills: 5 launchers (`feature-runner`, `refinement`, `refinement-runner`, `discovery-agent`, `drawing-agent`), 14 skills, 2 scripts de gate e o **`project.md`** — o formulário onde você declara a stack, os comandos de teste e as ferramentas do seu projeto. As skills são agnósticas: **só o `project.md` precisa ser preenchido**.
- `.claude/{agents,skills}` e `.cursor/{agents,skills}` — symlinks para `.agents/`, para Claude Code e Cursor lerem os mesmos arquivos. Se já existirem como diretórios reais, são movidos para `.bak-<timestamp>` antes.
- `.specs/config.json` — config da plataforma (porta, agente, terminal, `featuresDir`, `discoveriesDir`, `drawingsDir`).
- `.specs/specs/meta.json` + `_templates/` + a feature `exemplo/` — scaffold de docs (só se não existir ainda).
- `.specs/discoveries/meta.json` e `.specs/drawings/meta.json` — scaffolds de discoveries (RFCs, spikes, ADRs) e desenhos (Mermaid).
- `SPECS.md` — guia de operação e troubleshooting para quem abrir o projeto.
- `.gitignore` — entradas para o estado local (`.specs/.jobs.json`, `.specs/.run/`).

### Comandos

| Comando | O que faz |
|---|---|
| `specs install [dir]` (alias `update`) | Instala/atualiza. Idempotente: regrava agents/skills, preserva o que é do projeto. |
| `specs install --force` | Sobrescreve também `config.json`, `project.md`, `SPECS.md` e scaffolds. |
| `specs install --clean-legacy` | Remove o `.specs/app/` de instalações antigas. |
| `specs start` | Sobe UI + API numa porta só, em background (pid/log em `.specs/.run/`). |
| `specs start -f` | Foreground (Ctrl+C para parar). Flags: `-p <porta>`, `--no-open`, `--api-only`. |
| `specs status` / `specs stop` | Estado / parada da instância em background do projeto atual. |
| `specs statusline` | Imprime o trecho do `~/.claude/settings.json` para o medidor de uso do plano. |

### Atualizar

```bash
mircode-ai update                          # ou: npm i -g @mir-code/specs-platform@latest
specs install                             # propaga agents/skills novos para o projeto
```

### Migrando da versão antiga (`.specs/app/` + abbrs fish)

A versão anterior copiava o monorepo inteiro para `.specs/app/` e era operada por `specs:apply` / `specs:run` / `specs:stop`. Agora:

| Antes | Agora |
|---|---|
| `specs:apply` | `specs install` |
| `specs:run` | `specs start` |
| `specs:stop` | `specs stop` |
| `specs:logs` | `tail -f .specs/.run/specs.log` |
| Fastify `:4321` + Vite `:5173` | UI + API em `:4321` |

Rode `specs install --clean-legacy` em cada projeto e remova as abbrs `specs:*` do `config.fish`.

## Navegação — sidebar colapsável (shadcn/ui)

A marca da plataforma é o caret de um prompt (`›`) seguido de duas barras — a spec sendo escrita
por um agent. Ela vive em `internal/specs-ui/src/components/shell/specs-logo.tsx` (glifo nu, usado no
header e no rail da sidebar) e em `internal/specs-ui/public/favicon.svg` (mesmo glifo dentro de um
quadrado roxo, que é o que dá presença na aba do browser — o glifo nu some em abas claras).

A navegação lateral usa o componente `Sidebar` do **shadcn/ui**
(`internal/specs-ui/src/components/ui/sidebar.tsx`). Recolhe e expande por **⌘B / Ctrl+B** ou pelo botão
no topo dela; quando recolhida vira um **rail de 44px** com ícone, contador `em-andamento/total` e
o rótulo "SPECS" na vertical — clicar no rail reabre. O estado é persistido no cookie
`sidebar_state`.

Expandida, ela é dividida em: **header** (título + contador + "nova spec" + botão de recolher +
filtro "ocultar concluídas") e **content** (specs com tasks, discoveries, desenhos e protótipo —
todos com drag & drop).

Do outro lado da tela, na borda **direita**, fica a **sidebar de Execuções** (descrita abaixo) —
um segundo painel `Sidebar` que colapsa de forma independente. O layout é, então:
`[ Specs ][ conteúdo + índice da página ][ Execuções ]`.

Os tokens do shadcn/ui (`--sidebar*`, `--color-background`, `--color-primary`, …) são declarados em
`internal/specs-ui/src/styles/global.css` **mapeados na paleta dark existente** — a variável `--accent`
(roxo) continua sendo a cor de marca e a superfície de hover mora em `--surface-hover`.

## Atualização automática (sem F5)

O servidor observa `.specs/` com `fs.watch` recursivo e empurra as invalidações para a UI por SSE
em `GET /api/events`. Editar um `.md` por fora — um agent rodando, seu editor, um `git checkout` —
reflete na tela em **menos de meio segundo**, sem recarregar: o corpo da task, o título e o status
na sidebar, as discoveries, os desenhos e o `config.json`.

Cada caminho vira só as invalidações que ele implica (`internal/specs-server/src/specs-watcher.ts`): um
`.md` de task invalida aquele conteúdo **e** a árvore (o frontmatter carrega título e status); um
`meta.json`, só a árvore; o `config.json` arrasta o protótipo junto. Escritas em rajada — que é como
um editor salva — são agrupadas num lote deduplicado com 150 ms de debounce.

Cadências, depois dessa mudança:

| dado | como atualiza |
| --- | --- |
| árvore, conteúdo de task, discoveries, desenhos, config | push por SSE, sem polling |
| uso do plano | push por SSE (os arquivos de origem também são observados, com watch que se re-arma) + rede de segurança de 5 min |
| execuções (jobs) | polling adaptativo: 3 s com job ativo, 20 s com tudo terminado |

Jobs continuam em polling porque o estado ao vivo vive em memória no servidor, não no disco — não há arquivo para
observar. O que mudou é a cadência: antes eram 3 s para sempre.

Arquivos avulsos (os de uso do Claude) usam `watchFileRearming`: `fs.watch` prende o inode, e um
save atômico — gravar num `.tmp` e renomear por cima — o troca, matando o watch depois do primeiro
save. O watch é re-armado a cada evento, e retentado a cada 5 s enquanto o arquivo não existir.

Se o SSE cair, ou o SO não suportar watch recursivo (o `hello` do stream traz `watching: false`), a
UI volta sozinha a pollar a cada 10 s e reconecta com backoff — nunca fica desatualizada em
silêncio.

> Com revalidação ao vivo, os diálogos de edição semeiam o editor **uma vez** por abertura. Sem
> isso, um refetch no meio da digitação sobrescreveria o que ainda não foi salvo.

## Executions — terminal inline com a sidebar de Execuções

Toda execução disparada pela UI ("Rodar Tarefa", "Nova spec", "Nova discovery", "Novo desenho", "Editar via IA") passa por um gerenciador de jobs que roda o agent dentro do próprio servidor Fastify via PTY (`node-pty`), e streama a saída para um terminal xterm.js embutido na UI.

**Cada execução é etiquetada pela origem** — `Spec`, `Refino`, `Discovery`, `Desenho`, `Protótipo` — num badge colorido na sidebar e no cabeçalho do terminal, então dá para achar a execução certa sem ler o label inteiro.

**Mudança de estado não vira popup.** Quando um job passa a esperar input ou termina, a plataforma toca um som e marca o título da aba (`(!) Specs — 1 esperando`); quem mostra o quê é a sidebar de Execuções, com a linha realçada em âmbar e o trecho do terminal que fez a pergunta. Toast e Notification do browser foram removidos: eles despejavam o buffer cru do PTY numa caixa que o usuário não pediu. O ponto de status também distingue pela **forma**, não só pela cor — cheio e pulsando enquanto há processo vivo, anel vazado e estático quando acabou.

**As execuções sobrevivem ao restart.** O registro de cada job (label, tipo, tempos, status e o fim do buffer) é gravado em `.specs/.jobs.json`; ao subir, o servidor repõe a lista. Os processos não voltam — eram filhos do servidor anterior — então quem estava vivo reaparece como `Cancelado · sessão anterior`, legível mas sem input. O arquivo é estado local da máquina e entra no `.gitignore` pelo `specs install`.

- **Modal "Rodar Tarefa"** tem quatro seções: **Escopo** (feature / task / feature sem pausar), **Ferramenta** (**Claude Code** ou **Cursor**), **Modelo** e **Esforço**. As escolhas são persistidas em `localStorage`. A execução é sempre **inline** (terminal dentro da UI) — não há mais seletor "Onde rodar". O default de CLI fica em `agent.cli` (default `claude`) no `.specs/config.json`.
- **CLI selecionável (Claude Code / Cursor)** — todos os disparos (Rodar Tarefa, Nova spec, Nova discovery, Editar via IA) mostram o seletor **Ferramenta** quando há mais de uma CLI em `agent.commands`. O Cursor (`cursor-agent`) lê `.claude/agents/` por compatibilidade, então `feature-runner`/`refinement`/`discovery-agent` rodam nas duas CLIs sem duplicar arquivos.
- **Modelo selecionável (listagem automática)** — o seletor **Modelo** é populado por `GET /api/agent-models?cli=<cli>`. Para o Cursor, a lista é **dinâmica** via `cursor-agent --list-models`; para o Claude Code (que não expõe listagem por CLI), usa-se a lista estática de aliases em `agent.models`. O modelo escolhido vira `--model <id>` via placeholder `{model}` no comando. A escolha é lembrada por CLI no `localStorage`.
- **Dialog do terminal** abre ao criar um job inline — xterm completo com input, botão **Minimizar** (mantém rodando em background) e **Parar** (SIGINT → SIGTERM → SIGKILL).
- **Sidebar de Execuções** — painel lateral próprio (288px) na borda **direita** da tela, colapsável de forma independente (vira um rail de 44px com ícone, contador e rótulo vertical; estado lembrado em `localStorage`). Lista os jobs **ordenados por data de execução, mais recente primeiro** — com data relativa ("agora", "há 12 min", "hoje 14:03", "ontem 23:40", "04/07 08:00"), tipo, status e duração. Clicar reabre o terminal; o botão de ação no hover para (execução ativa) ou remove do histórico (execução finalizada). O contador no header mostra `ativas/total`.
- **Uso do plano** no rodapé da sidebar de Execuções: barra preenchida da janela de **sessão (5h)** e da **semanal (7d)**, com percentual usado, quanto resta e quanto falta para resetar. A fonte é local — o histórico que o app desktop do Claude grava em `~/Library/Application Support/Claude/plan-usage-history.json` a cada ~15–25 min enquanto está aberto, com o `~/.claude/rate-limits-cache.json` do CLI como fallback quando for mais recente. O horário do reset **não** está nesses arquivos, então é deduzido das quedas de percentual do histórico (marcado com `~`): a janela de 5h ancora na hora cheia dentro do intervalo da última queda; a semanal, que tem fase fixa, é achada testando cada hora do período e pesando cada queda pela estreiteza do seu intervalo. O carimbo "há N min" ao lado do título mostra a idade da medida. Passando de **45 min** (bem acima do intervalo normal de gravação, ~15–25 min), o bloco inteiro esmaece, ganha um ícone de alerta e troca o rodapé por "medida congelada" — um número velho aqui é pior que número nenhum, porque a janela de sessão pode ter virado sem a gente ver. E quando a janela de 5h está zerada com dado fresco, o rodapé diz "janela parada · começa na próxima mensagem", que é o estado real: ela só volta a correr quando você manda a próxima mensagem. Sem nenhuma das duas fontes, o bloco simplesmente não aparece.
- **Notificações** quando um job muda de estado: contador colorido na sidebar de Execuções, `document.title` com `(!) Specs — N esperando`, toast (Sonner), notificação do SO (com permissão) e beep sutil via WebAudio. Som pode ser desabilitado em `agent.sound: false`.
- **Detecção de input pendente** — o server analisa o buffer do PTY após cada chunk e marca `needs-input` quando detecta padrões do Claude Code (`?`, `(y/N)`, `Do you want to`, `❯`) ou inatividade > 2.5s. Padrões customizáveis em `agent.inputPromptPatterns`.

Campos novos no `.specs/config.json` (todos com defaults retrocompatíveis):

```json
{
  "agent": {
    "cli": "claude",
    "commands": {
      "claude": "claude {model} {effort} --agent feature-runner \"{prompt}\"",
      "cursor": "cursor-agent {model} \"Use the feature-runner subagent. {prompt}\""
    },
    "modelsCommand": { "cursor": "cursor-agent --list-models" },
    "models": { "claude": ["opus", "sonnet", "haiku", "fable"] },
    "defaultExecutionMode": "inline",
    "sound": true,
    "inputPromptPatterns": ["\\?\\s*$", "\\((?:y\\/n|Y\\/n|y\\/N|Y\\/N)\\)", "Do you want to", "❯\\s*$"],
    "bufferBytesCap": 2000000
  }
}
```

Endpoints adicionados (todos em `http://localhost:4321`):

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/jobs` | Cria job (inline ou external). Body: `{ kind, mode, cli?, model?, effort?, ...payload }`. |
| `GET` | `/api/jobs` | Lista jobs ativos/finalizados. |
| `GET` | `/api/agent-models?cli=<cli>` | Lista modelos da CLI (`{ models: {id,label}[], source }`). |
| `GET` | `/api/jobs/:id` | Snapshot + buffer completo. |
| `GET` | `/api/jobs/:id/stream` | SSE — chunks + mudanças de status. |
| `POST` | `/api/jobs/:id/input` | Escreve no PTY (keystrokes). |
| `POST` | `/api/jobs/:id/resize` | Resize do PTY. |
| `POST` | `/api/jobs/:id/stop` | SIGINT → SIGTERM → SIGKILL. |
| `DELETE` | `/api/jobs/:id` | Remove job terminado do histórico. |

As rotas antigas `/api/run-agent`, `/api/run-refinement`, `/api/run-discovery-agent` continuam funcionais (modo `external` agora vai pela mesma UI via `/api/jobs`, mas os clientes existentes seguem compatíveis).

## Requisitos

- Node.js >= 20 (o seu projeto não precisa ser Node)
- macOS ou Linux (Windows não testado). O PTY usa `node-pty` com prebuilts para `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`.

## Onde está o código

| Parte | Caminho no monorepo |
|---|---|
| CLI `specs` (install/start/stop) | `packages/specs-platform/src/` |
| Template copiado para o projeto | `packages/specs-platform/assets/template/` |
| Servidor Fastify (interno, embutido no bundle) | `internal/specs-server/` |
| UI Vite + React (interna, build em `dist/ui`) | `internal/specs-ui/` |

## Escolha de modelo e esforço

O modal **Rodar Tarefa** (e os diálogos de refinement/discovery) trazem dois seletores do design
system, ordenados sempre do mais leve ao mais capaz:

- **Modelo** — barra de potência (verde → amarelo → vermelho), custo por milhão de tokens
  (entrada / saída), janela de contexto e selos de variante: **promo** (preço promocional
  vigente), nível de esforço embutido no id, **thinking** e **fast**. Listas com mais de 8 itens
  ganham **campo de busca** no topo (casa por nome, id e fornecedor).
- **Catálogo por família, não por id** (`internal/specs-ui/src/lib/model-catalog.ts`) — o `cursor-agent`
  lista ~200 ids que são a mesma família com sufixos (`claude-opus-5-thinking-xhigh-fast`), então
  o resolvedor descasca `-fast`, `-thinking` e o nível de esforço até achar a família.
- **De onde vem cada informação** — preço e janela de contexto só são declarados para os modelos
  do catálogo oficial Claude. Para o resto, a janela vem do label que a própria CLI devolve
  ("Opus 5 1M Thinking") e o preço simplesmente não aparece: a CLI do Cursor não publica tabela e
  estimativa seria pior que omissão. No Cursor, o preço mostrado é o da API Anthropic e serve como
  referência de peso relativo — o consumo real sai do plano do Cursor.
- **Esforço** — `low` · `medium` · `high` · `xhigh` · `max`, com uma linha explicando o que cada
  nível troca. No Claude Code vira `--effort <nível>`; no cursor-agent, parâmetro do próprio
  modelo (`modelo[effort=…]`), então lá ele exige um modelo escolhido. Quando o id do modelo já
  fixa o nível (`…-max`, `…-thinking-high`), o seletor de esforço desabilita e diz qual nível está
  em vigor, em vez de deixar você passar um valor conflitante.

Ambos são persistidos por CLI no navegador e reaproveitados pelo atalho `R`. A execução é sempre
**inline** (terminal dentro da UI).

## Code review local

Toda task tem um botão **Revisar** na topbar (`/features/<slug>/<task>/review`). A tela mostra as
alterações do working tree contra o `HEAD` — staged, não staged e untracked — agrupadas em
**Código**, **Specs e documentação** e **Gerados e mecânicos** (lock, snapshot, migration SQL).

- **Tudo nasce recolhido** — a tela abre com a lista fechada e nada de diff carregado; expandir é
  uma escolha (por arquivo, por commit, ou **Expandir tudo** no cabeçalho). Cada arquivo é um card
  com status, contagem `+/−` e o diff colorido com numeração de linha, carregado **sob demanda**.
- **Abrir no editor** dispara o comando de `review.openCommand` no `.specs/config.json`
  (default `cursor --goto {path}:{line}`; troque por `code --goto {path}:{line}`, `idea`, etc.).
- **Revisar** marca o arquivo como visto; a marcação é local e cai sozinha quando o arquivo muda
  de novo, então retomar uma revisão interrompida não exige recomeçar.

Quando a execução é de uma **feature inteira**, o `feature-runner` fecha cada task em um commit
local e só faz push no fim. A tela então mostra **um bloco por commit** — um por task, com o diff
isolado — e, abaixo, o que ainda está no working tree. Sem isso, revisar uma feature de 20 tasks
seria um único diff plano de centenas de arquivos. A seção "Commits não enviados" é um bloco
colapsável e também começa fechada, para quem represa vários commits antes de dar push.

O botão **Revisar** da topbar sinaliza quando há trabalho esperando: fica destacado e mostra a
quantidade de arquivos não commitados e, com a seta `↑`, quantos commits locais ainda não foram
enviados.

Endpoints: `GET /api/review/changes`, `GET /api/review/diff?path=[&commit=]`,
`POST /api/review/open`.

## Protótipo — Claude Design ou Pencil

Projetos com entregável visual declaram o protótipo no `.specs/config.json`. É essa declaração que
diz **qual ferramenta** o projeto usa — e tanto a Specs Platform quanto os agents partem dela antes
de qualquer verificação visual:

```json
{
  "prototype": {
    "tool": "claude-design",
    "title": "Finance — redesign com shadcn/ui",
    "url": "https://claude.ai/code/artifact/<id>",
    "designDir": "design/finance-redesign",
    "artboards": ["Desktop", "Mobile", "Loading", "Erro e vazio"]
  }
}
```

| Campo | Para quê |
|---|---|
| `tool` | `claude-design` (canvas publicado, endereçado por `url`) ou `pencil` (arquivo `.pen` local, endereçado por `file`). |
| `title` | Nome exibido no painel. |
| `url` / `file` | O alvo. Um dos dois é obrigatório, conforme a ferramenta — declaração incompleta é ignorada em vez de virar botão quebrado. |
| `designDir` | Pasta com o `README.md` de decisões do protótipo (a parte versionada). |
| `artboards` | Telas listadas no painel. |
| `nodeIds` | Pencil: nós de referência, quando o projeto quiser fixá-los. |
| `openCommand` | Pencil: sobrescreve `open -a Pencil {file}`. |
| `snapshot` | HTML do protótipo salvo no repo, servido pela plataforma para o iframe. Default: `<designDir>/canvas.html`. |

O `meta.json` de uma feature pode declarar o seu próprio bloco `prototype`, que **substitui** o do
projeto — uma feature pode estar em outra ferramenta que o resto do repositório. Sem bloco algum, a
plataforma esconde o painel e os agents pulam a fase visual.

**Na Specs Platform**, a navegação lateral ganha a seção **Protótipo**, que abre a página
`/prototype` — o protótipo renderizado **dentro do app**, em iframe, sem trocar de aba. Como o canvas
publicado manda `frame-ancestors 'self'` (vale para `/artifact/<id>`, `/embed` e
`/public/artifacts/<id>`), o que vai no iframe é o **snapshot local**: o HTML do canvas salvo no
repositório e servido pelo próprio Fastify, em `GET /api/prototype/frame`. O snapshot renderiza o
canvas completo, em modo somente leitura, com todos os artboards.

Botões da página: **Sincronizar** (dispara um job que relê o canvas publicado e regrava o snapshot),
**Editar no canvas** / **Abrir no Pencil**, e **Pedir alteração**.

As páginas de feature e de task também ganham o painel **Protótipo**, com a fonte da verdade, os
artboards e os botões **Ver aqui** (leva à página com o iframe), **Editar no canvas** e **Pedir
alteração** — este abre um diálogo de texto livre e dispara um **job** como qualquer execução de
agent (terminal ao vivo, notificação ao fim). O prompt é montado pelo servidor conforme a
ferramenta: `/design ...` no Claude Design; instrução de editar pelo **Pencil MCP**, devolvendo os
node IDs afetados, no Pencil. Feature e task vão junto como contexto.

**Nos agents**, a skill `prototype-check` carrega o fluxo completo: identificar a ferramenta
primeiro, e só então aplicar as verificações dela — artboards por nome no Claude Design (não há node
ID lá), consulta e node IDs pelo Pencil MCP no Pencil (o `.pen` é encriptado; nunca `Read`/`Grep`).

Endpoints: `GET /api/prototype[?feature=]`, `GET /api/prototype/frame[?feature=]`,
`POST /api/prototype/open`, e `POST /api/jobs` com `kind: "design"` (`intent: "change" | "snapshot"`).

## Formato das páginas

O renderer suporta GFM, tabelas, syntax highlight, Mermaid e HTML embutido. Três convenções
valem para todo conteúdo em `.specs/specs/`:

- **Título único** — o `title` do frontmatter vira o `<h1>` da página. Não repita um `# Título`
  no corpo (se repetir, o renderer descarta o duplicado).
- **Blocos expansíveis** — `<details>`/`<summary>` colapsam o detalhamento técnico longo. Deixe
  uma linha em branco depois do `</summary>` e antes do `</details>` para o markdown interno ser
  interpretado.
- **Diagramas Mermaid** — clique no diagrama (ou no ícone de expandir) para abrir em tela cheia,
  com fit automático, zoom por scroll e pan por arrasto. Convenção de cores nos templates:
  `:::changed` amarelo (alterado), `:::added` verde (adicionado), `:::removed` vermelho
  (removido), `:::untouched` cinza (contexto).

Cada feature pode ter um `overview.md` (visão macro + diagrama da feature inteira). Ele é a
página de `/features/<slug>` e lista as tasks com status abaixo do conteúdo; sem ele, a rota
redireciona para a primeira task.

## Uso do plano sem depender do app desktop

O medidor "Uso do plano" no rodapé das Execuções lê a fonte local **mais recente** entre três:

| fonte | quem escreve | quando |
| --- | --- | --- |
| `statusline` | `assets/specs-usage-statusline.sh`, plugado no seu `statusLine` | a cada turno de uma sessão do Claude Code |
| `desktop-history` | app desktop do Claude (`plan-usage-history.json`) | a cada ~15–25 min, **só com o app aberto** |
| `cli-cache` | `~/.claude/rate-limits-cache.json` | fóssil: versões recentes do Claude Code não reescrevem mais |

**Não existe endpoint da API para isso.** A Usage & Cost Admin API exige chave de organização do
Console (indisponível para contas individuais) e reporta tokens/custo da API — não a janela de 5h/7d
do plano Pro/Max. O dado da janela só chega em headers de uma resposta da API. Quem o recebe e
repassa é o **Claude Code**, no JSON do statusLine (`rate_limits.five_hour` / `.seven_day`), para
assinantes Pro/Max e a partir da primeira resposta da sessão.

Daí a fonte `statusline`: um script no meio do caminho grava esse pedaço em
`~/.claude/specs-usage.json` — que o servidor observa — e repassa o mesmo JSON ao seu statusLine
original, ecoando a saída dele sem alterar nada. `specs statusline` imprime o trecho para o
`~/.claude/settings.json` com o caminho do script dentro do pacote instalado:

```json
"statusLine": {
  "type": "command",
  "command": "bash <pacote>/assets/specs-usage-statusline.sh ~/.claude/statusline-command.sh"
}
```

Sem statusLine próprio, chame sem o argumento final — o script imprime `Modelo · 5h N% · 7d N%`.
Requer `jq`. Sem `rate_limits` no payload (conta API key, ou antes da primeira resposta) o script
não toca no arquivo: um snapshot antigo e honesto vale mais que um vazio.

Com essa fonte, o reset das janelas vem **medido**, não inferido do histórico (`resetEstimated: false`).

Passando de 45 min sem medida nova o bloco esmaece; passando de 12 horas ele para de mostrar
porcentagem e diz há quanto tempo está sem medida — um número velho com cara de número atual é
pior que número nenhum.

## Agents e skills entregues

Os **launchers** de `.agents/agents/` têm 15 linhas: frontmatter e uma frase mandando carregar a
skill de mesmo nome. Todo o comportamento vive nas skills. Para mudar o que um agente faz, edite a
skill — nunca o launcher.

### Os 5 agentes

| Agent | Quando usar |
|---|---|
| **`refinement`** | "refine X" / "detalhe essa feature" — transforma descrição em task documentada em `.specs/specs/`. |
| **`refinement-runner`** | "refine e já executa X" — esgota as dúvidas, implementa e para no code review. Não cria documento de spec. |
| **`feature-runner`** | "execute X" / "roda a task Y" — implementa a task documentada, para antes do commit. |
| **`discovery-agent`** | "pesquise", "avalie alternativas", "faça um spike" — produz RFC/spike/ADR em `.specs/discoveries/`. |
| **`drawing-agent`** | "desenhe a arquitetura", "mapeie o fluxo" — produz diagrama Mermaid em `.specs/drawings/`. |

### As 14 skills

**Processo** — o que fazer, em que ordem. Cada uma tem `SKILL.md` curto com princípios e mapa de
fases; o detalhe de cada fase mora em `references/`, lido só quando a fase começa.

`feature-runner` · `refinement` · `refinement-runner` · `discovery-agent` · `drawing-agent` ·
`execution-protocol` (protocolo comum aos runners: princípios invioláveis, blast radius, git,
halt → ajustar → complete).

**Conhecimento** — como fazer bem:

| Skill | Cobre |
|---|---|
| `spec-writing` | estrutura da página de spec, diagrama Mermaid com código de cores, blocos expansíveis, `overview.md`, registro de Execuções |
| `requirements-closure` | critérios de aceite em EARS, IDs de requisito, sweep das 9 dimensões implícitas, portão de fechamento |
| `test-strategy` | matriz de cobertura por camada, os três gates, co-location de testes, Test Adequacy Review (A–D) |
| `verification` | Verifier independente (autor ≠ verificador), evidence-or-zero, sensor de discriminação por injeção de falha |
| `discovery-writing` | os quatro tipos (rfc/spike/adr/note), frontmatter, estrutura por tipo |
| `drawing-writing` | os cinco tipos de desenho, o frontmatter e a regra de "só o diagrama" |
| `mermaid-diagramming` | Mermaid que renderiza de primeira neste renderer: layout, paleta escura, `classDef`, armadilhas |
| `prototype-check` | identificar a ferramenta de protótipo (Claude Design ou Pencil) e consultá-la antes de implementar |

### A customização mora em um arquivo só

As skills são **agnósticas ao projeto**: contêm método, não valores. Não sabem sua stack, seus
caminhos de teste, sua lib de UI nem sua ferramenta de protótipo.

Isso tudo vive em **`.agents/project.md`**, que chega como formulário em branco. Enquanto um campo
estiver `<preencher>`, a skill que depende dele **para e pergunta** em vez de adivinhar; campo que
não se aplica recebe `n/a`.

| Seção de `project.md` | Consumida por |
|---|---|
| Identidade · Stack | `feature-runner`, `refinement` |
| Pacotes, testes e comandos | `test-strategy` |
| Convenções de código | `execution-protocol`, `feature-runner` |
| Design e UI · Segurança de inputs | `ui-standards`, `input-security` (skills opcionais) |
| Ferramentas visuais | `prototype-check` |
| Scratch e temporários | `verification` |

**Consequência prática:** em `specs install`, agentes e skills são **sempre atualizados** — o template
evolui e propaga. Só o `project.md` e as skills que você adicionou por conta própria são preservados.
Customize pelo `project.md`, não editando skill.

### Skills opcionais

`ui-standards` (padrões de UI) e `input-security` (sanitização de inputs) são referenciadas pelas
skills de processo como **condicionais**: se existirem no projeto, são carregadas; se não, o agente
segue sem elas. Para adotá-las, copie de um projeto que as tenha e preencha as seções
correspondentes do `project.md`.

### Gates determinísticos

O que é estrutural roda por código, não por memória:

```bash
node .agents/scripts/validate-spec.mjs .specs/specs/<slug>/feat-<slug>-<task>.md
node .agents/scripts/check-commit.mjs --message "feat(login): tela de login"
```

Saída ≠ 0 significa **pare e corrija**.

Operação da plataforma (subir, parar, atualizar, diagnosticar) é feita pelo CLI `specs` +
troubleshooting em `SPECS.md`. O antigo agent `specs-runner` foi descontinuado —
`specs install` remove o arquivo se existir de uma versão anterior.

## Desinstalar

```bash
specs stop
rm -rf .specs/.run .specs/.jobs.json .specs/config.json
npm rm -g @mir-code/specs-platform
# .agents/ e os symlinks .claude//.cursor/ podem permanecer — os agents funcionam sem a UI.
# .specs/specs/ também permanece — é o seu conteúdo.
```

## Licença

MIT
