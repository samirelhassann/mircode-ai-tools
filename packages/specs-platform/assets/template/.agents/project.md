# Configuração do projeto

**Preencha este arquivo ao instalar a Specs Platform.** Ele é a fonte única dos valores concretos
que as skills consomem: as skills contêm o *método*, este arquivo contém o *que este projeto usa*.
Nenhuma skill precisa ser editada.

Enquanto uma seção estiver como `<preencher>`, a skill que depende dela vai **parar e perguntar** em
vez de adivinhar. Seção que não se aplica: escreva `n/a` — a skill registra "não se aplica a este
projeto" e segue.

---

## Identidade

| Campo | Valor |
|---|---|
| Nome | `<preencher>` |
| Domínio | `<uma linha: o que o produto faz>` |
| Idioma do código | `<ex.: inglês — identificadores, comentários, rotas, colunas, enums>` |
| Idioma do conteúdo | `<ex.: pt-BR — UI, mensagens ao usuário, docs, commits>` |

## Stack

| Camada | Tecnologia |
|---|---|
| Repositório | `<ex.: monorepo Turborepo + pnpm · ou repo único>` |
| Frontend | `<ex.: Next.js 16 + Tailwind · ou n/a>` |
| Backend | `<ex.: Fastify + TypeScript · Spring Boot · FastAPI>` |
| Banco | `<ex.: PostgreSQL + Prisma>` |
| Lint/format | `<ex.: Biome · ESLint + Prettier · Spotless>` |
| Runner de teste | `<ex.: vitest · jest · JUnit · pytest>` |

## Pacotes, testes e comandos

Usado por `test-strategy` (matriz de cobertura e gates).

Uma linha por camada de código do projeto. O que importa é que cada camada tenha **onde o teste
mora** e **qual comando o roda**.

| Camada de código | Tipo de teste | Onde o teste mora | Comando |
|---|---|---|---|
| `<ex.: use case / regra de negócio>` | unit | `<path>` | `<comando>` |
| `<ex.: adapter / repositório>` | integration | `<path>` | `<comando>` |
| `<ex.: rota / controller>` | integration (contrato) | `<path>` | `<comando>` |
| `<ex.: utilitário compartilhado>` | unit | `<path>` | `<comando>` |
| `<ex.: tela / componente>` | E2E | via `prototype-check` | `<sub-agente com a tool de E2E>` |
| `<ex.: entidade, DTO, tipo, config>` | nenhum | — | só o gate de build |

**Comandos de gate**

| Nível | Comando |
|---|---|
| rápido | `<comando de um pacote só>` |
| completo | `<comando de vários pacotes>` |
| build | `<comando de lint/build>` + os testes dos pacotes tocados |

**Flag obrigatória:** `<ex.: -- --run, para o runner não entrar em watch mode>` · `n/a` se não houver.

**Comando que roda o repositório inteiro** (caro, só no gate build): `<preencher>`

**Referência de rigor** — o módulo cujo padrão de teste é o mais alto do repositório, e que novos
testes não devem subverter: `<path · ou n/a se o repo ainda não tem testes>`

**Convenções de teste:** `<ex.: arquivo em kebab-case, código em inglês, path conforme a matriz>`

## Convenções de código

Usado por `execution-protocol` e `feature-runner`.

| Item | Valor |
|---|---|
| Formatação | `<ex.: Biome — singleQuote, semicolons: asNeeded, lineWidth 100, 2 espaços>` |
| Tipagem | `<ex.: TypeScript strict>` |
| Nome de arquivo | `<ex.: kebab-case em todo o repositório>` |
| Comando de lint + format | `<preencher>` |
| Comando de build completo | `<preencher — e avise se for caro>` |

**Onde procurar reuso antes de criar** (utilitário, tipo, componente, hook):
`<liste os diretórios>`

**Libs cuja versão costuma mudar decisão** (consulte a doc atual antes de decidir):
`<liste · ou n/a>`

## Design e UI

Usado por `ui-standards`, se o projeto adotar essa skill. `n/a` para projeto sem frontend.

| Item | Valor |
|---|---|
| Primitivos headless | `<ex.: Radix UI · Headless UI · n/a>` |
| Framework de CSS | `<ex.: Tailwind v4 · CSS Modules>` |
| Exemplo de token | `<ex.: bg-brand-yellow — nunca bg-[var(--color-brand-yellow)]>` |
| API de toast | `<ex.: notify de @/components/ui/toast>` |
| Formulários | `<ex.: react-hook-form + Zod, mode: 'onTouched'>` |
| Textos estáticos | `<ex.: CMS via getCmsText() · arquivo de i18n · hardcoded>` |
| Breakpoints | `<ex.: Desktop 1440 · Tablet 768 · Mobile 375 (mínimo testável: 320px)>` |

**Equivalências px → escala do framework:** `<preencher se o framework tiver escala própria>`

## Segurança de inputs

Usado por `input-security`, se o projeto adotar essa skill.

| Item | Valor |
|---|---|
| Módulo das funções | `<path · ou "criar em <path>" se ainda não existir>` |
| Código de erro | `<ex.: INPUT_NOT_ALLOWED ⇒ HTTP 400 com mensagem genérica>` |
| Validação | `<ex.: schemas Zod — .transform(sanitize*) + .refine(assert*); body .strict()>` |
| ORM | `<ex.: Prisma — parametriza queries, não substitui a camada defensiva>` |

**Funções disponíveis:** `<liste as que já existem>`

**Dados sensíveis deste domínio:** `<ex.: CPF nunca em claro no log; placa como hash truncado>`

## Ferramentas visuais

Usado por `prototype-check`.

| Papel | Ferramenta | Observações |
|---|---|---|
| Protótipo | `<pencil · claude-design · figma · n/a>` | `<ex.: arquivos .pen são encriptados — só via MCP>` |
| E2E de navegador | `<ex.: Playwright MCP · n/a>` | — |
| Disponibilidade | `<ex.: ambas só em sub-agentes>` | delegue com `Agent` / `Task` + `subagent_type` |

**Credenciais de teste E2E:** `<usuário / senha · ou aponte o .env.test>`

**Health check do dev server:** `<ex.: curl na raiz do app>`

**Override por feature:** o bloco `prototype` do `.specs/config.json` — sobrescrito pelo `meta.json`
da feature quando ele declarar o seu — define a ferramenta de protótipo caso ela varie entre
features. Valores suportados: `pencil` (arquivo `.pen`, consulta por MCP, tem node IDs) e
`claude-design` (canvas endereçado por `url`, referência por nome de artboard). Sem bloco: o projeto
não tem protótipo.

## Documentação e processo

Estes valores vêm da Specs Platform e normalmente **não mudam** entre projetos.

| Item | Valor |
|---|---|
| Specs | `.specs/specs/<slug>/feat-<slug>-<task>.md` |
| Discoveries | `.specs/discoveries/<slug>.md` |
| Desenhos | `.specs/drawings/<slug>.md` |
| Memória de projeto | `.specs/STATE.md` — `## Decisions` (`AD-NNN`) e `## Handoff` |
| Renderização | Specs Platform (`@mir-code/specs-platform`) — sobe com `specs start`; troubleshooting em `SPECS.md` |
| Convenções gerais | `CLAUDE.md`/`AGENTS.md` na raiz e em cada app |

**Formato de commit:** `<ex.: tipo(escopo): descrição, com Refs: <caminho da spec>>`

**Extensões de arquivo que contam como "path de código"** (usado pelo validador de spec, que proíbe
citar path concreto na spec): `<ex.: ts, tsx, prisma, json, http>` — espelhe em `CODE_EXTENSIONS` de
`.agents/scripts/validate-spec.mjs`.

## Scratch e temporários

| Item | Valor |
|---|---|
| Prefixo de worktree descartável | `<ex.: /tmp/<projeto>-sensor>` |
