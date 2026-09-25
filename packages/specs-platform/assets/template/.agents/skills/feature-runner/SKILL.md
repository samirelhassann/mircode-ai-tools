---
name: feature-runner
description: Executa tarefas documentadas em `.specs/specs/` — localiza a task, carrega contexto, confronta a spec com o código atual, implementa, roda o gate, dispara a verificação independente e PARA antes de commitar para code review humano. Entre tasks reentra em "Prosseguir"; commita e faz push apenas no "Complete" final; "Ajustar: ..." itera sem commitar. Carregue ao executar, implementar, rodar ou tocar uma feature ou task do projeto.
---

# feature-runner

Executa tarefas documentadas em `.specs/specs/`. A stack, os comandos e as convenções do projeto
estão em [`.agents/project.md`](../../project.md) — leia-o junto com a `execution-protocol`.

O ciclo: **localizar → contextualizar → confrontar → implementar → verificar → halt para code
review → complete**.

Equivalências de tools Claude Code ↔ Cursor: `.agents/RUNTIME.md`.

## Ponto de partida obrigatório

**Carregue a skill `execution-protocol` antes de qualquer coisa.** Ela detém os princípios
invioláveis (nada de commit sem aprovação, nada de ação destrutiva, escopo fechado, blast radius),
a verificação do repositório, as convenções de código e todo o ciclo halt → ajustar → complete.
Esta skill aqui só cobre o que é específico de executar uma spec.

## Skills por camada

| Carregue | Quando |
|---|---|
| `execution-protocol` | **sempre**, antes de tudo |
| `spec-writing` | **sempre** — você lê a task, atualiza `status` e escreve o registro de Execuções no formato dela |
| `test-strategy` | a entrega produz código testável — define o gate que fecha cada task |
| `verification` | a entrega produz código com teste automatizado — o Verifier roda antes do halt |
| `input-security` | o código toca input do usuário (formulário, body, query/path param, cookie, header, upload, webhook) (opcional — só se o projeto adotar essa skill) |
| `ui-standards` | a task cria ou altera tela/componente (opcional — só se o projeto adotar essa skill) |
| `prototype-check` | a task tem entregável visual — consulta obrigatória ao protótipo antes de implementar |

Task de backend puro: `execution-protocol` + `spec-writing` + `test-strategy` + `verification` +
`input-security`. As convenções de arquitetura de cada app estão nos respectivos `CLAUDE.md`.

## Fluxo

Ponto de entrada pelo contexto: pedido de execução ⇒ **1**; **"Prosseguir"** ⇒ volta ao **3** com a
próxima task; **"Ajustar: ..."** ⇒ ciclo de ajuste do `execution-protocol`; **"Complete"** ⇒ **7**.

1. **Localizar a task e carregar contexto** → [localizar.md](references/localizar.md)
2. **Verificar o repositório** → `execution-protocol`
3. **Confrontar a spec com o código atual** → [divergencias.md](references/divergencias.md)
4. **Marcar `in-progress` e implementar** → [implementar.md](references/implementar.md)
5. **Gate + verificação independente** → skills `test-strategy` e `verification`
6. **Halt** → [relatorio-halt.md](../execution-protocol/references/relatorio-halt.md)
   — intermediário (resta task pendente) oferece "Prosseguir"; final oferece "Complete"
7. **Complete, só no fim de tudo** → [git.md](../execution-protocol/references/git.md)

Leia cada referência **por completo** no momento em que a fase começa — não antecipe todas.

## Modo feature

Quando o pedido é a feature inteira, execute as tasks na ordem de `meta.json.pages`, pulando as
`completed`. Só pare quando todas estiverem `completed` ou o usuário abortar.

**Por padrão há pausa de review a cada task:** você entrega o relatório de halt daquela task e
aguarda **"Prosseguir"** (avança para a próxima) ou **"Ajustar: ..."** (itera nesta). O usuário
pode dispensar a pausa, e aí você encadeia as tasks sozinho até a última.

**Em nenhum dos dois o git roda no meio.** Cada task intermediária fecha com `status: completed` no
frontmatter, o registro em Execuções e o código no **working tree**. O commit e o push acontecem
**uma vez só**, no "Complete" depois da última task. A pausa muda quanto você revisa pelo caminho,
nunca quanto é commitado.

Não ofereça "Complete" enquanto restar task pendente — ver
[relatorio-halt.md](../execution-protocol/references/relatorio-halt.md).

## Specs Platform

As docs são renderizadas pela Specs Platform (`@mir-code/specs-platform`) — `specs start` na raiz
sobe a plataforma localmente. O botão "Rodar Tarefa" da UI dispara esta skill em um terminal novo, conforme
`.specs/config.json`. Problema operacional da plataforma (não sobe, porta ocupada, botão não
dispara): consulte o **Troubleshooting** de `SPECS.md` antes de mexer na configuração.

## Notas

- Chame tools em paralelo quando forem independentes.
- Mantenha o relatório de halt enxuto — ele é a pauta do code review.
