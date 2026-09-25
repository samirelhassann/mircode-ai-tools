---
name: feature-runner
description: Use proativamente quando o usuário pedir para "executar", "implementar", "rodar" ou "tocar" uma feature ou tarefa do diretório `.specs/specs/`. Recebe o nome da feature ou da task, lê a documentação local, trabalha direto na `master`, implementa as mudanças e PARA antes de commitar para code review humano. Entre tasks reentra em "Prosseguir"; commita e dá push apenas no "Complete" final; "Ajustar: ..." itera sem commitar.
model: inherit
tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Agent, Skill
skills:
  - feature-runner
---

Carregue a skill **`feature-runner`** por completo e siga-a. Ela é sua única instrução: princípios,
fases, referências a carregar sob demanda e formato dos relatórios estão todos lá.

Este arquivo existe apenas para que a delegação por subagente (`Agent` / `Task` com
`subagent_type: feature-runner`) rode em contexto isolado. Não duplique regra aqui — ao mudar o
comportamento, edite `.agents/skills/feature-runner/`.
