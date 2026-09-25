# Git: stage, commit e push

Entrada: o usuário respondeu **"Complete"**. Só com aprovação explícita. **Nunca antecipe.**

> **O git roda uma vez só, no Complete final.** Não existe commit automático, não existe commit
> intermediário, não existe commit local "de checkpoint". Em qualquer modo — task avulsa, feature
> com pausa ou feature sem pausa — nada é commitado enquanto o usuário não disser "Complete" no fim
> de tudo. Entre tasks o usuário diz **"Prosseguir"**, e isso **não toca no git**.

## Procedimento

1. `git rev-parse --abbrev-ref HEAD` (deve ser `master`) e `git pull --ff-only origin master`.
   Falhou ⇒ pare e reporte.

2. **Atualize o status da task** no frontmatter: `in-progress` → `completed`.
   (O `refinement-runner` não tem arquivo de task — pule este passo e o seguinte.)

3. **Registre a execução** no fim do arquivo da task, no formato da skill `spec-writing` (seção
   `## Execuções`, entrada nova no topo, dentro de um `<details>`). Data via
   `date '+%d/%m/%Y %H:%M'`; tipo = o `<type>` do commit em maiúsculo. Máximo 8 bullets,
   específicos ("Criado `.../health-routes.ts` com rota `GET /health`", não "adicionada rota").

4. **Recalcule o status agregado da feature** lendo o frontmatter de todas as tasks de
   `meta.json.pages`: `completed` se todas; `in-progress` se houver mistura ou alguma em
   andamento; `pending` se todas pendentes. **Não invente** campo `status` no `meta.json` — o
   agregado só aparece na mensagem de commit.

5. **Stage por nome explícito** — nunca `git add -A` nem `git add .`:

   ```bash
   git add -- <arquivo1> <arquivo2> <task.md>
   ```

   Confira com `git status` que **só** o esperado está staged.

6. **Valide a mensagem antes de commitar:**

   ```bash
   node .agents/scripts/check-commit.mjs --message "<type>(<feature-slug>): <título da task>"
   ```

   Saída ≠ 0 ⇒ corrija o formato antes de seguir.

7. **Commit com HEREDOC:**

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<feature-slug>): <título da task>

   Refs: .specs/specs/<slug>/feat-<slug>-<task>.md
   Task status: in-progress -> completed
   Feature status: <pending|in-progress|completed>

   Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

   Hook de pre-commit falhou ⇒ **corrija e faça um commit novo**. Nunca `--amend` nem
   `--no-verify`. Unidades lógicas claramente separáveis podem virar commits separados
   referenciando a mesma task.

8. **Push — condicional ao modo** (ver abaixo). Falhou ⇒ pare e reporte. Nunca `--force`.

9. **Reporte:**

   ```markdown
   ## Complete

   **Branch:** `master` (commit direto)
   **Commit(s):** <hash curto> — <título da task>
   **Push:** origin/master @ <hash curto>
   **Status final da task:** completed
   **Status agregado da feature:** <pending|in-progress|completed>
   ```

## Quando este procedimento roda

| Modo | Entre tasks | Git |
|---|---|---|
| **Task avulsa** | — | no Complete, ao fim da task |
| **Feature com pausa** (padrão) | halt de review a cada task; usuário diz **"Prosseguir"** | **uma vez só**, no Complete depois da última task |
| **Feature sem pausa** | nenhum halt; avança sozinho | **uma vez só**, no Complete depois da última task |

Nos dois modos de feature, cada task intermediária termina com `status: completed` no frontmatter,
o registro em Execuções e o código no **working tree** — e nada mais. O commit cobre a feature
inteira.

> **Por que um commit só.** O revisor avalia a feature de uma vez. Commit intermediário congela
> decisão que ainda pode mudar no review e obriga commit de correção em cima. E um working tree
> limpo de commits parciais é trivial de descartar se a feature inteira for rejeitada.

Unidades lógicas claramente separáveis podem virar **commits separados no mesmo Complete** — isso é
organização do diff final, não checkpoint intermediário.

Vale sempre: **nenhum commit e nenhum push sem "Complete" explícito no chat.**

## Depois do Complete

Reporte e encerre. Não há próxima task a executar: o Complete só acontece quando todas já estão
`completed` no working tree.

Se por algum motivo restar task `pending` em `pages` (o usuário pediu Complete antes do fim),
**avise explicitamente** quais ficaram de fora e confirme que é intencional antes de commitar.
