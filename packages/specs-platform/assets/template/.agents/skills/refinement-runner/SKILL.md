---
name: refinement-runner
description: Refinamento com execução imediata — entende a atividade, mapeia o terreno, esgota todas as dúvidas antes de tocar em código, implementa e PARA antes de commitar para code review humano, sem criar nem alterar documento em `.specs/specs/`. Carregue ao pedir "refinar e executar", "fazer direto", ou ao descrever uma atividade para ver implementada sem passar por spec.
---

# refinement-runner

Existe para o caso em que **documentar a task custa mais do que fazê-la**: você faz o trabalho de
refinamento — entender, mapear o terreno, fechar o escopo, **tirar todas as dúvidas** — e em
seguida executa, sem produzir nenhum documento em `.specs/specs/`.

É a fusão do `refinement` (entender + mapear + fechar requisitos) com o `feature-runner`
(implementar + verificar + halt). Quando a atividade for grande o bastante para merecer spec
versionada, **pare e recomende** o `refinement`.

Equivalências de tools Claude Code ↔ Cursor: `.agents/RUNTIME.md`.

## Ponto de partida obrigatório

**Carregue a skill `execution-protocol` antes de qualquer coisa** — princípios invioláveis,
verificação do repositório, convenções de código, ciclo halt → ajustar → complete.

Além dela: **nunca crie nem edite arquivos em `.specs/specs/`.** Nem task, nem `overview.md`, nem
`meta.json`. Seu entregável é código no working tree. Precisa de documentação? é sinal de que a
atividade deveria ter ido para o `refinement` — diga isso.

## Skills por camada

| Carregue | Quando |
|---|---|
| `execution-protocol` | **sempre**, antes de tudo |
| `requirements-closure` | **sempre** — é ela que define quando o escopo está fechado, e aqui não há spec para conferir depois |
| `test-strategy` | a atividade produz código testável |
| `verification` | a atividade produz código com teste automatizado |
| `input-security` | a atividade toca input do usuário (opcional — só se o projeto adotar essa skill) |
| `ui-standards` | a atividade cria ou altera tela/componente (opcional — só se o projeto adotar essa skill) |
| `prototype-check` | a atividade tem entregável visual |

`spec-writing` **não** é carregada: você não escreve spec. O que a substitui é a skill
`requirements-closure` como régua do escopo consolidado da Fase 3.

## Fluxo

Ponto de entrada pelo contexto: pedido novo ⇒ **0**; "Ajustar: ..." e "Complete" ⇒ ciclos do
`execution-protocol`. Aqui a entrega é única, então não há halt intermediário nem "Prosseguir":
o halt da Fase 7 já é o final, e é ele que oferece "Complete".

### 0. Protótipo (quando a atividade for visual)

Antes de ler código, **descubra qual ferramenta de protótipo o projeto usa** — o bloco `prototype`
do `.specs/config.json`, sobrescrito pelo `meta.json` da feature quando ele declarar o seu:

- `tool: "claude-design"` ⇒ canvas do Claude Design, endereçado pela `url`; as decisões versionadas
  estão em `<designDir>/README.md`. Não há node ID nem MCP — referencie artboards pelo nome.
- `tool: "pencil"` ⇒ arquivo `.pen` (encriptado, nunca `Read`/`Grep`); a consulta é pelo Pencil MCP,
  e é ali que você **obtém os node IDs** dos nós alvo.
- sem bloco ⇒ o projeto não tem protótipo: siga sem fase visual e registre isso no relatório.

Carregue `prototype-check` para o fluxo de consulta. Sem acesso ao protótipo para uma tela que
deveria existir, **pare e informe o usuário**.

### 1. Entender a atividade

Identifique **o quê**, **por quê** e **onde** (frontend, backend, ambos, infra, docs).

**Teste de tamanho — faça já.** Se a atividade toca mais de uma camada com contratos novos entre
elas, ou se você já enxerga que ela se quebraria em três ou mais tasks independentes, **pare** e
recomende o `refinement` (com o `feature-runner` depois). Explique o porquê em uma linha e deixe a
decisão com o usuário via `AskUserQuestion` / `AskQuestion`: "Refinar e documentar primeiro" vs.
"Seguir direto mesmo assim".

### 2. Mapear o terreno

Siga [mapear-terreno.md](../refinement/references/mapear-terreno.md) — inclusive a leitura
**obrigatória** de `.specs/STATE.md` `## Decisions` antes de qualquer decisão arquitetural.

Duas paradas específicas desta skill:

- **Reuso antes de criação.** Procure utilitários, tipos compartilhados, componentes e hooks que já
  existem antes de planejar código novo.
- **Task já documentada.** Encontrou em `.specs/specs/` uma task que cobre o que foi pedido?
  **pare e avise**: o caminho certo ali é o `feature-runner`, não você.

### 3. Esgotar as dúvidas — o portão

Esta é a fase que justifica sua existência. **Você não passa daqui com pergunta em aberto.** Sem
spec escrita, não há segunda chance de pegar a ambiguidade: ela vira código errado direto.

1. **Rode o sweep das 9 dimensões implícitas** da skill `requirements-closure`. Cada dimensão
   resolve para um requisito **ou** um `N/A porque <motivo>`. Nunca em branco. É o que impede a
   pergunta que ninguém lembrou de fazer — falha de dependência externa, idempotência, ciclo de
   vida do dado.
2. **Classifique cada decisão** que a implementação vai exigir:
   - **Decidível pelo código** — o projeto já tem convenção, padrão análogo ou tipo pronto. Decida
     sozinho e registre como decisão no relatório. Não pergunte o óbvio.
   - **Ambígua de verdade** — escopo, comportamento esperado, contrato de API, biblioteca, UX,
     tratamento de erro, regra de negócio, caminho triste. **Pergunte.**
3. **Dispare as perguntas agrupadas** (`AskUserQuestion` / `AskQuestion`, até 4 por chamada), cada
   uma com 2–4 opções concretas e uma recomendação quando você tiver opinião informada.

Nunca pergunte "posso prosseguir?". Só saia daqui quando a próxima pergunta que você consegue
formular for sobre algo fora do escopo.

### 4. Fechar o escopo

Consolide **para si mesmo** (ainda sem escrever arquivo nenhum), aplicando o portão de fechamento
da skill `requirements-closure`:

- o que entra e o que **não** entra;
- os critérios de aceite em EARS, objetivos e ancorados em código que existe de verdade;
- a tabela de premissas — o que você decidiu sozinho, com default e racional;
- os arquivos que você espera tocar;
- o gate que vai fechar a entrega (skill `test-strategy`);
- a checklist de code review que vai para o relatório de halt.

**Esse consolidado é o que substitui o documento de spec** e é o que você reporta no halt.

### 5. Verificar o repositório

Skill `execution-protocol`.

### 6. Implementar

Siga [implementar.md](../feature-runner/references/implementar.md), pulando o passo de marcar
`in-progress` (não há arquivo de task). Os critérios de aceite são os da Fase 4.

Descobriu na implementação que uma decisão da Fase 3 não se sustenta? **volte e pergunte** — não
improvise uma saída.

### 7. Verificação e halt

Skill `verification`, depois
[relatorio-halt.md](../execution-protocol/references/relatorio-halt.md). Deixe explícito no
relatório que **nenhum arquivo em `.specs/specs/` foi criado ou alterado**, e inclua o escopo
consolidado da Fase 4 junto com a tabela de premissas.

### 8. Ajustar / Complete

Ciclos do `execution-protocol`. Sem arquivo de task, o commit não carrega `Refs:` nem atualização
de status — a mensagem descreve o que foi feito.

## Specs Platform

O botão "+" da sidebar pergunta entre **Refinamento** (`refinement`) e **Refinamento + execução**
(você). A UI envia `POST /api/jobs` com `kind: refinement-runner` e a CLI escolhida.
