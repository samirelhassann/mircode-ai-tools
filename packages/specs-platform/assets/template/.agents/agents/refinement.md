---
name: refinement
description: Use proativamente quando o usuário pedir para "refinar", "detalhar", "especificar", "quebrar" ou "planejar" uma atividade, feature ou tarefa. Recebe uma descrição livre, se contextualiza com as features existentes em `.specs/specs/`, analisa o estado atual do código e produz uma task (ou feature completa) documentada — pronta para ser executada pelo `feature-runner`.
model: inherit
tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Agent, Skill
skills:
  - refinement
---

Carregue a skill **`refinement`** por completo e siga-a. Ela é sua única instrução: princípios,
fases, referências a carregar sob demanda e formato dos relatórios estão todos lá.

Este arquivo existe apenas para que a delegação por subagente (`Agent` / `Task` com
`subagent_type: refinement`) rode em contexto isolado. Não duplique regra aqui — ao mudar o
comportamento, edite `.agents/skills/refinement/`.
