---
name: execution-protocol
description: Protocolo de execução comum aos agentes que escrevem código — princípios invioláveis (nada de commit sem aprovação, nada de ação destrutiva, escopo fechado), blast radius, verificação do repositório antes de começar, o ciclo halt → ajustar → complete e o formato do relatório de code review. Carregue no início de qualquer execução que produza código.
---

# Protocolo de execução

Vale para `feature-runner` e `refinement-runner`. Eles diferem no que leem antes de implementar;
daqui para frente, o comportamento é o mesmo.

## Princípios invioláveis

1. **Nunca commite, dê push ou merge sem aprovação explícita no chat.** A execução padrão termina
   **antes** do commit, com o relatório de halt.
2. **Nunca use ação destrutiva como atalho.** Proibidos: `git reset --hard`, `push --force`,
   `--no-verify`, `--amend`, `git add -A`, `git add .`, `git clean -f`, `git checkout .`,
   `git stash` como forma de "guardar" trabalho. Deu errado? investigue a causa e reporte.
3. **Blast radius.** Aprovação de spec ou de escopo autoriza **implementação local** e nada mais.
   O commit e o push só acontecem após um **"Complete"** explícito, e ele é pedido uma vez só, no
   fim de tudo — "Prosseguir" entre tasks **não** autoriza git. Não autoriza force-push, deploy, migration
   em produção, alteração de infra externa nem nada visível fora do repositório — cada uma dessas
   exige go-ahead explícito **para aquela ação**, mesmo com a execução já aprovada.
4. **Não expanda escopo.** Apareceu algo fora do que foi fechado? vira **ponto de atenção** no
   relatório, não código. A heurística: *"isso está na definição da minha task?"* Se não, não toque.
5. **Nunca invente convenção, ferramenta ou biblioteca nova** sem aprovação. Use o que o monorepo
   já tem.
6. **Respeite as restrições de leitura** dos arquivos de design: o `project.md` indica quais são
   encriptados e só podem ser lidos pela tool do MCP, nunca por `Read`/`Grep`.
7. **Nunca crie arquivo `.md` novo** a menos que a atividade peça documentação.
8. **Pergunte diante de ambiguidade real** de escopo, design, contrato de API ou biblioteca —
   pergunta estruturada (`AskUserQuestion` / `AskQuestion`) com 2–4 opções concretas. Nunca
   pergunte "posso prosseguir?"; prossiga quando o caminho estiver claro.
9. **Opere com paths absolutos** e **responda em português brasileiro**.

## Verificar o repositório (antes de tocar em código)

1. `git status --porcelain` — working tree sujo ⇒ **pare e pergunte** (pode ser trabalho do usuário).
2. `git rev-parse --abbrev-ref HEAD` — deve ser `master`; se não for, `git checkout master`.
3. `git pull --ff-only origin master`.
4. Falhou (não fast-forward, conflito, sem rede) ⇒ **pare e reporte**. Nunca recupere com ação
   destrutiva.

Todo o trabalho é feito direto na `master`. Não crie branches.

**Deduza o tipo do commit já aqui:** `feat` (mais comum), `fix`, `refactor`, `chore`, `docs`,
`test`, `infra`. Ambíguo ⇒ pergunte agora, não no fim.

## Convenções de código

- **Formatação e tipagem** conforme a seção *Convenções de código* de
  [`.agents/project.md`](../../project.md).
- **Reusar antes de criar:** utilitários, tipos, componentes, hooks. Procure com `Grep`/`Glob` nos
  diretórios de reuso que o `project.md` lista, antes de escrever qualquer coisa nova.
- **Idioma do código e do conteúdo** conforme a seção *Identidade* do `project.md` (arquivo, classe,
  função, variável, comentário, rota, coluna seguem o idioma do código; texto de usuário final e
  documentação seguem o idioma do conteúdo).
- **Comentário só como JSDoc curto** acima de classe/função/interface/tipo exportado. Nada de
  comentário inline narrando passo a passo, banner de seção, JSDoc em constante ou nota de decisão
  (isso vive na spec). Ao editar, remova esse tipo de comentário na região tocada. Exceções:
  `TODO:`/`FIXME:` com contexto real e supressões justificadas.
- Use as tools dedicadas de leitura/edição (`Read`, `Edit`/`StrReplace`, `Write`, `Glob`, `Grep`).
  Terminal (`Bash`/`Shell`) só para git, gerenciador de pacotes e checagens — nunca `cat`/`grep`/`sed`.

## Gate por task

Toda task que produz código testável roda o gate do pacote tocado **antes** de ser dada como
pronta. Os níveis, os comandos reais e a matriz de cobertura estão na skill **`test-strategy`** —
carregue-a. Em resumo: rode o gate do pacote tocado (comando no `project.md`), saída ≠ 0 é bloqueio, e a contagem
de testes não pode cair sem justificativa.

## Verificação antes do halt

Entrega com código testável passa pela skill **`verification`** antes do relatório: um sub-agente
novo re-deriva a cobertura com evidence-or-zero e roda o sensor de discriminação. O bloco que ele
devolve entra no relatório como seção própria — é o que o code review humano lê no lugar de prosa.

## O ciclo halt → ajustar → complete

**O git roda uma vez só, no Complete final.** Não existe commit automático nem commit
intermediário — em nenhum modo. Entre tasks de uma feature o usuário diz "Prosseguir", e isso não
toca no git: a task fecha com `status: completed` e o código no working tree.

As três entradas possíveis:

| Entrada | O que faz |
|---|---|
| **"Prosseguir"** | aprova a task atual e avança para a próxima. **Nenhum git.** Só aparece quando ainda há task pendente |
| **"Ajustar: ..."** | itera na entrega atual e repete o halt, sem commitar |
| **"Complete"** | **único** ponto em que o git roda: stage, commit e push. Só é oferecido no halt final |

Detalhes nas referências:

- [Relatório de halt](references/relatorio-halt.md) — o formato, os dois tipos de halt
  (intermediário e final) e o que acrescentar quando a task é visual ou não tem input externo.
- [Git: stage, commit e push](references/git.md) — o procedimento do Complete e quando ele roda em
  cada modo.

**Entrada "Ajustar: ..."** ⇒ confirme a branch, aplique **apenas** o solicitado (não expanda
escopo), e volte ao halt com o relatório atualizado. Se o ajuste trouxer ambiguidade nova,
**pergunte antes de implementar**.

**"Esquece" / "abortar" / "cancela"** ⇒ pare imediatamente e pergunte se deve reverter o working
tree. **Não reverta por conta própria.**

## Pausa de sessão

Trabalho interrompido no meio (o usuário encerra, o contexto acaba, aparece bloqueio externo):
antes de sair, substitua **apenas** a seção `## Handoff` de `.specs/STATE.md` pelo snapshot atual.
O formato e a regra de escrita section-scoped estão no próprio arquivo. **Não toque na seção
`## Decisions`** — sobrescrever o arquivo inteiro apaga o log de decisões em silêncio.
