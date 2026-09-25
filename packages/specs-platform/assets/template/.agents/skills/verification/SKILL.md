---
name: verification
description: Verificação independente antes do halt — sub-agente Verifier (autor ≠ verificador), cobertura re-derivada com evidence-or-zero, sensor de discriminação por injeção de falha em git worktree descartável, o relatório de validação e o loop limitado de correção. Carregue antes do halt de qualquer task que produza código com teste automatizado.
---

# Verificação independente

O agente que escreveu o código e os testes é o **autor**. Autor conferindo o próprio trabalho
reaplica o mesmo modelo mental que produziu as lacunas — e não as vê. Por isso a verificação é
delegada a um **sub-agente novo**, que re-deriva a cobertura a partir dos critérios de aceite, sem
herdar o raciocínio de quem implementou.

Essa separação é o portão de qualidade. Não é preferência de estilo.

## Quando roda

Depois da última task implementada e **antes** do relatório de halt, sempre que a entrega produziu
código com teste automatizado. O resultado vira uma seção do relatório de halt — o code review
humano recebe uma tabela de evidência em vez de prosa.

**Não roda** em: task só de documentação, só de config/infra sem lógica, ou ajuste visual puro
(nesse caso quem verifica é o E2E, conforme o `project.md`).

O Verifier é **read-only** sobre a árvore real: ele não escreve, não corrige e não commita.

## Como delegar

Um `Agent` (Claude Code) / `Task` (Cursor) novo, com o payload:

- os critérios de aceite da task (com os IDs, se houver) — **a fonte de verdade**;
- o range de diff da entrega (`git diff --stat` do working tree, ou o range de commits);
- os arquivos de teste no escopo;
- esta skill como checklist de operação;
- a matriz de cobertura e o comando de gate da skill `test-strategy`.

## 1. Cobertura ancorada na spec (evidence-or-zero)

Para cada critério de aceite, o Verifier monta:

| Critério (ID / EARS) | Desfecho definido na spec | `file:line` + asserção | Resultado |
|---|---|---|---|
| CADASTRO-03 | 409 + `CPF_ALREADY_REGISTERED` | `src/__tests__/unit/auth-use-cases.test.ts:88` — `expect(res.errorCode).toBe('CPF_ALREADY_REGISTERED')` | ✅ |
| CADASTRO-07 | — | — | ❌ sem evidência |

Regras:

- **Sem `file:line` + expressão da asserção, o critério conta como NÃO coberto.** Nome do `it(...)`
  não é evidência; a expressão da asserção é.
- Onde a spec define desfecho preciso, a asserção tem que mirar **aquele** valor. Asserção que
  existe mas afirma outra coisa é lacuna, não cobertura.
- Onde a spec **não** define desfecho preciso, marque `⚠️ lacuna de precisão na spec` e reporte.
  Não passe asserção vaga como cobertura.
- Antes de declarar um critério descoberto, mostre a busca feita (`Grep` no arquivo de teste).
  Ausência declarada sem busca é chute.

## 2. Gate

Rode o gate de build da `test-strategy` para os pacotes tocados e registre: total, passou, falhou,
pulado (cada `skip` com justificativa), e a **variação da contagem** de testes em relação ao estado
anterior. Contagem que caiu sem justificativa é achado, não detalhe.

## 3. Sensor de discriminação

Gate verde prova que a suíte **roda**. O sensor prova que ela **detecta regressão**.

### Procedimento

1. **Baseline.** Rode `git status --porcelain` e guarde a saída. Ela tem que estar idêntica no fim.
2. **Scratch isolado.** Crie um worktree descartável:
   ```bash
   git worktree add <prefixo do project.md> HEAD
   ```
   Sem worktree disponível: copie só os arquivos afetados para um diretório temporário e mute as
   cópias.
   **Proibido `git stash`.** O stash grava o estado *antes* da mutação; dar `pop` depois não
   reverte a mutação aplicada em seguida, e numa árvore limpa ele nem cria entrada — a falha fica
   na árvore real.
3. **Injete a falha** no scratch, no código novo desta entrega. Escolha proporcional ao risco:
   - inverter condição booleana (`if (x)` → `if (!x)`, `>` → `>=`);
   - mudar valor de retorno (status errado, campo errado, zero no lugar do calculado);
   - erro de um (deslocar limite de loop, índice de slice);
   - remover side-effect exigido pela spec (apagar uma chamada de persistência ou de log).
4. **Rode os testes que cobrem o código mutado**, apontando para o scratch.
5. **Confirme que o mutante morreu** (os testes FALHAM). Descarte:
   ```bash
   git worktree remove --force <prefixo do project.md>
   ```
6. **Confirme o isolamento.** `git status --porcelain` na árvore real tem que bater com o baseline
   do passo 1. Divergiu? **pare**, restaure a árvore e trate a rodada do sensor como inválida.
7. **Mutante sobrevivente** (testes continuam verdes com a falha injetada) = o teste não discrimina
   aquele comportamento. Vira item de correção **antes** do halt.

### Profundidade

| Contexto | Mutações |
|---|---|
| Padrão | 1 a 3, focadas no código novo de maior risco |
| Caminho crítico — pagamento, autenticação, consulta veicular, integridade de dado | ≥5, cobrindo todos os ramos |

## 4. Relatório

O Verifier devolve ao agente que o disparou:

```markdown
## Verificação — <task> — PASS ✅ | FAIL ❌

**Cobertura ancorada na spec:** <N/N critérios com desfecho batendo> | <M lacunas de precisão>
**Gate:** <X passou, Y falhou> (contagem antes: <A> → depois: <B>)
**Sensor:** <N mutações, N mortas, N sobreviventes>

| Critério | Desfecho na spec | `file:line` + asserção | Resultado |
|---|---|---|---|

| Mutação | `file:line` | O que mudou | Morreu? |
|---|---|---|---|

**Lacunas, por severidade:**
1. <lacuna> — <critério> — <file:line ou "sem evidência">
```

Esse bloco entra **integral** no relatório de halt, como seção `### Verificação independente`.

## 5. Loop de correção

`FAIL` ⇒ o agente autor corrige as lacunas na ordem reportada e **redispara um Verifier novo**
(não reaproveite o anterior: ele já viu a resposta).

**Máximo de 3 rodadas** correção → reverificação. Persistindo lacuna na quarta, **pare e escale ao
usuário** com o que foi tentado. Não fique iterando.

## 6. Blast radius

Aprovar spec ou escopo autoriza **implementação local** e nada mais; o commit só acontece após um **"Complete"** explícito, pedido uma vez só no fim de tudo. Não autoriza
`git push --force`, deploy, migration em produção, nem nenhuma operação externamente visível ou
destrutiva — cada uma dessas exige go-ahead explícito **para aquela ação**, mesmo que a execução já
tenha sido aprovada.

## Se não houver como rodar sub-agente

Rode o mesmo checklist você mesmo, mas **do zero**: releia os critérios de aceite e o diff
ignorando o que você lembra da implementação, aplique evidence-or-zero, rode o sensor, e declare no
relatório: *"Verificação executada pelo próprio autor (sub-agente indisponível) — o portão autor ≠
verificador não foi satisfeito."* O usuário precisa saber que a garantia foi mais fraca.
