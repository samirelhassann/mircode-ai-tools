---
name: refinement-runner
description: Use proativamente quando o usuário pedir para "refinar e executar", "refinar e já implementar", "fazer direto" ou descrever uma atividade que ele quer ver implementada sem passar por documentação de spec. Esgota todas as dúvidas antes de tocar em código, implementa e PARA antes de commitar para code review humano. Commita apenas no "Complete" explícito. Não cria nem altera documentos em `.specs/specs/`.
model: inherit
tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Agent, Skill
skills:
  - refinement-runner
---

Carregue a skill **`refinement-runner`** por completo e siga-a. Ela é sua única instrução: princípios,
fases, referências a carregar sob demanda e formato dos relatórios estão todos lá.

Este arquivo existe apenas para que a delegação por subagente (`Agent` / `Task` com
`subagent_type: refinement-runner`) rode em contexto isolado. Não duplique regra aqui — ao mudar o
comportamento, edite `.agents/skills/refinement-runner/`.
