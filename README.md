# mircode-ai-tools

Monorepo das ferramentas de IA da mircode. Cada ferramenta é um pacote npm instalável sozinho (`@mir-code/<ferramenta>`), e o CLI `mircode-ai` (`@mir-code/ai-tools`) reúne todas num menu interativo.

```bash
npm i -g @mir-code/ai-tools          # todas, via `mircode-ai`
npm i -g @mir-code/specs-platform    # só a Specs Platform, via `specs`
```

| Pacote | Bin | O que é |
|---|---|---|
| [`@mir-code/ai-tools`](packages/ai-tools) | `mircode-ai` | CLI guarda-chuva: menu interativo + `mircode-ai <tool> <comando>` |
| [`@mir-code/specs-platform`](packages/specs-platform) | `specs` | Documentação de specs/features com UI local e disparo de agents |

## Estrutura

```
mircode-ai-tools/
├── packages/                  # PUBLICADOS no npm (@mir-code/*)
│   ├── ai-tools/              # @mir-code/ai-tools — bin `mircode-ai`, registry das tools
│   └── specs-platform/        # @mir-code/specs-platform — bin `specs`
│       ├── src/               #   CLI + definição da tool (install/start/stop/status)
│       └── assets/template/   #   o que `specs install` grava no projeto consumidor
├── internal/                  # PRIVADOS — embutidos no bundle dos pacotes publicados
│   ├── toolkit-core/          # contrato `defineTool` + helpers (copy, symlink, .gitignore, log)
│   ├── specs-server/          # Fastify da Specs Platform
│   └── specs-ui/              # Vite + React da Specs Platform (build → specs-platform/dist/ui)
├── scripts/release/           # semantic-release por pacote (ver "Versionamento")
└── .github/workflows/         # CI (PR) e release (push na main)
```

**Por que `internal/`?** Server, UI e core são detalhes de implementação. O tsup embute o source deles no `dist/` do pacote publicado (`noExternal`), e as dependências de runtime deles ficam declaradas no `package.json` do pacote publicado. Assim só publicamos o que o usuário instala.

### Como o `mircode-ai` descobre as ferramentas

Todo pacote publicado exporta um `defineTool(...)` (contrato em `internal/toolkit-core/src/tool.ts`):

- `register(cmd)` — registra os subcomandos. É usado tanto pelo bin próprio do pacote (`specs install`) quanto pelo `mircode-ai` (`mircode-ai specs-platform install`).
- `actions` — entradas do menu interativo.

O `@mir-code/ai-tools` depende dos pacotes das ferramentas e as lista em `packages/ai-tools/src/registry.ts`.

## Adicionar uma ferramenta nova (ex.: `@mir-code/harness-toolkit`)

1. Crie `packages/harness-toolkit/` copiando a estrutura de `packages/specs-platform/` (`package.json` com `bin`, `tsup.config.ts`, `tsconfig.json` com o `paths` do toolkit-core, `src/cli.ts`, `src/index.ts`, `src/tool.ts`).
2. Em `src/tool.ts`, exporte `harnessToolkitTool = defineTool({ id: 'harness-toolkit', register, actions, ... })`.
3. Se precisar de código compartilhado com outras tools, coloque em `internal/toolkit-core`; código só dela e grande o bastante para separar, em `internal/harness-*`.
4. Em `packages/ai-tools`: adicione `"@mir-code/harness-toolkit": "workspace:^"` às `dependencies` e o tool em `src/registry.ts`.
5. `pnpm install && pnpm build && pnpm test`.

## Desenvolvimento

```bash
pnpm install
pnpm build        # internal/specs-ui → specs-platform (+ dist/ui) → ai-tools
pnpm test
pnpm typecheck    # requer build (o ai-tools consome o .d.ts do specs-platform)
pnpm check        # biome
```

Usar a versão local como se estivesse instalada (builda e linka todos os pacotes de `packages/`):

```bash
pnpm link:global      # `mircode-ai`, `specs`, ... apontando para este repo
pnpm unlink:global    # remove os links
```

Depois de linkar, basta `pnpm build` (ou `pnpm --filter <pacote> dev` em watch) para os comandos globais refletirem as mudanças. Requer o diretório global do pnpm: rode `pnpm setup` uma vez (no fish: `set -Ux PNPM_HOME ~/Library/pnpm; fish_add_path $PNPM_HOME`).

Desenvolver a UI da Specs Platform com hot reload — num projeto com `specs install` feito:

```bash
specs start -f --api-only                  # API em :4321 (terminal 1, na raiz do projeto)
pnpm --filter @mir-code/specs-ui dev        # UI em :5173 com proxy para /api (terminal 2, neste repo)
```

## Versionamento e publicação (semantic-release)

Cada pacote de `packages/` tem **versão, tag, CHANGELOG e release próprios**, calculados a partir das mensagens de commit ([Conventional Commits](https://www.conventionalcommits.org/pt-br/)):

| Commit | Release |
|---|---|
| `fix: ...` / `perf: ...` | patch (1.0.**1**) |
| `feat: ...` | minor (1.**1**.0) |
| `feat!: ...` ou rodapé `BREAKING CHANGE: ...` | major (**2**.0.0) |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:` | nenhum |

O scope é livre e só aparece no CHANGELOG (ex.: `fix(specs-ui): ...`). O hook `commit-msg` (husky + commitlint) recusa mensagens fora do padrão.

**Quais commits contam para cada pacote:** os que tocam a pasta dele **ou a de qualquer dependência de workspace, transitivamente**. Na prática:

| Pacote | Pastas observadas |
|---|---|
| `@mir-code/specs-platform` | `packages/specs-platform`, `internal/specs-server`, `internal/specs-ui`, `internal/toolkit-core` |
| `@mir-code/ai-tools` | `packages/ai-tools` + tudo que o `specs-platform` observa |

Um `fix:` em `internal/specs-server` gera patch do `specs-platform` (o server vai embutido no bundle) e do `ai-tools` (que depende dele). Um `feat:` só em `packages/ai-tools` não mexe no `specs-platform`. Um pacote novo entra sozinho: os caminhos saem das dependências do `package.json`.

### Como roda

- **CI (`.github/workflows/release.yml`)**: a cada push na `main`, builda, testa e roda `pnpm release`. Para cada pacote, em ordem de dependência: atualiza `version` e `CHANGELOG.md`, `pnpm publish` (converte `workspace:^` na versão recém-publicada), comita `chore(release): <pacote>@<versão> [skip ci]`, cria a tag `<pacote>@<versão>` e o GitHub Release.
- **Local**: `pnpm release:dry` mostra a próxima versão e as notas de cada pacote sem publicar nada (`--package @mir-code/specs-platform` para um só).

O motor é o `scripts/release/release.mjs` (um `semantic-release` por pacote) + o plugin `scripts/release/path-filter.mjs` (filtra os commits pelos caminhos acima). Não usamos multi-semantic-release/semantic-release-monorepo porque eles só olham a pasta do próprio pacote e perderiam as mudanças em `internal/`.

### Configuração necessária (uma vez)

1. Repositório no GitHub com a branch `main` (o `origin` define o `repositoryUrl`).
2. Secret `NPM_TOKEN`: token granular do npm com permissão de publish no escopo `@mir-code` (a org `mir-code` precisa existir no npm).
3. Se a `main` for protegida, permita que o `github-actions[bot]` faça push (o release comita versão e CHANGELOG de volta).

Sem tag anterior, o primeiro release de cada pacote sai como **1.0.0**. Para começar em 0.x, crie a tag inicial antes do primeiro push (ex.: `git tag @mir-code/specs-platform@0.1.0`). Nos `package.json` a versão fica `0.0.0-development`: quem define a versão real é o release.
