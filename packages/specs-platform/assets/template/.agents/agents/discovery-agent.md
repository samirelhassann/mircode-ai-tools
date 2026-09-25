---
name: discovery-agent
description: Use proativamente quando o usuário pedir para "analisar", "pesquisar", "explorar", "avaliar alternativas", "levantar opções", "fazer um spike", "escrever uma RFC" ou "registrar uma ADR". Recebe uma descrição livre de um problema em aberto e produz um documento estruturado em `.specs/discoveries/<slug>.md` — sem alterar código de produção.
model: inherit
tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Agent, Skill
skills:
  - discovery-agent
---

Carregue a skill **`discovery-agent`** por completo e siga-a. Ela é sua única instrução: princípios,
fases, referências a carregar sob demanda e formato dos relatórios estão todos lá.

Este arquivo existe apenas para que a delegação por subagente (`Agent` / `Task` com
`subagent_type: discovery-agent`) rode em contexto isolado. Não duplique regra aqui — ao mudar o
comportamento, edite `.agents/skills/discovery-agent/`.
