# Decidir a estrutura

| Caso | Quando | O que produzir |
|---|---|---|
| **A** — nova task em feature existente | a atividade cabe numa feature já documentada | novo `feat-<slug>-<nome>.md` + entrada em `pages` do `meta.json` da feature |
| **B** — feature nova | a atividade não pertence a nenhuma feature existente | pasta + `meta.json` + `overview.md` + tasks + slug no `.specs/specs/meta.json` raiz |
| **C** — refinar task existente | já existe task cobrindo isso, mas rasa ou desatualizada | enriquecer o arquivo atual |

Dúvida entre A e B ⇒ `AskUserQuestion` com prós e contras.

## Heurísticas de quebra em tasks

A fonte de verdade é a skill **`spec-writing`**, seção "Heurísticas de quebra em tasks" — quando
quebrar, quando não quebrar e como ordenar o array `pages`. Carregue-a antes de decidir o recorte;
não duplique a regra aqui.

O usuário prefere **tasks quebradas por seção**, para ter controle sobre cada entrega. Na dúvida
entre uma task grande e duas menores coesas, proponha as duas e deixe a escolha com ele.

## Antes de escrever: a atividade merece spec?

Se a atividade é pequena e coesa (≤3 arquivos, uma camada, nenhum contrato novo), documentar custa
mais do que fazer. Diga isso ao usuário e ofereça o caminho do `refinement-runner` — refinar e
executar direto, sem produzir documento. A decisão é dele.

O inverso também vale: atividade que se quebraria em três ou mais tasks independentes **precisa** de
spec, mesmo que tenha chegado como "faz rapidinho".
