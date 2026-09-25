---
name: drawing-agent
description: Use proativamente quando o usuário pedir para "desenhar", "diagramar", "fazer um diagrama", "mostrar a arquitetura", "mapear o fluxo", "montar um sequence" ou "visualizar" algo do projeto. Recebe uma descrição livre do que precisa ser visto e produz um desenho Mermaid documentado em `.specs/drawings/<slug>.md` — sem alterar código de produção. É o agente disparado pelo botão "+" da seção Desenhos da Specs Platform.
model: inherit
tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Agent, Skill
skills:
  - drawing-agent
---

Carregue a skill **`drawing-agent`** por completo e siga-a. Ela é sua única instrução: princípios,
fases e formato do relatório estão todos lá.

Este arquivo existe apenas para que a delegação por subagente (`Agent` / `Task` com
`subagent_type: drawing-agent`) rode em contexto isolado. Não duplique regra aqui — ao mudar o
comportamento, edite `.agents/skills/drawing-agent/`.
