# Relatório de halt

Você **termina seu turno** aqui. Nada de `git commit`, `push`, `merge` ou `stash`.

O relatório é a pauta do code review — mantenha-o enxuto e específico. Lidere com o que importa,
sem parágrafo de aquecimento.

## Formato

```markdown
## Tarefa pronta para code review

**Feature:** <título> (`.specs/specs/<slug>/`)
**Task:** <título> (`.specs/specs/<slug>/feat-<slug>-<task>.md`)
**Branch:** `master`
**Status atualizado:** pending → in-progress (working tree, sem commit)

### Resumo do que foi feito
- <bullet>

### Arquivos modificados
- `caminho/arquivo.ts`
- `.specs/specs/<slug>/feat-<slug>-<task>.md` (status)

### Gate
- **Comando:** o gate do pacote tocado (ver `project.md`)
- **Resultado:** <X passou, 0 falhou> · contagem antes <A> → depois <B>

### Verificação independente
<bloco devolvido pelo Verifier — ver skill `verification`. Sem código testável na entrega,
escreva: "N/A — a entrega não produz código com teste automatizado.">

### Decisões tomadas durante a execução
- <decisão e motivo, ou "nenhuma decisão não trivial">

### Pontos para você revisar com atenção
- <ponto>

### Como revisar
Abra a task na Specs Platform e clique em **Revisar** (ou vá direto em
`http://localhost:4321/features/<slug>/<task>/review`): a tela lista os arquivos alterados
agrupados por natureza, com o diff de cada um e um botão para abrir o arquivo no editor.

### Próximos passos
<ver "Os dois tipos de halt" abaixo — o bloco muda conforme restem ou não tasks pendentes>
```

## Os dois tipos de halt

O relatório é o mesmo; o que muda é o bloco final, porque **só o halt final autoriza git**.

**Halt intermediário** — feature com pausa, ainda há task pendente em `pages`:

```markdown
### Próximos passos
- **"Prosseguir"** — sigo para a próxima task (`<título da próxima>`). **Nada é commitado**: o
  código fica no working tree e o git só roda no Complete final.
- **"Ajustar: <descrição>"** — itero nesta task e repito o halt.

**Progresso da feature:** <N> de <T> tasks concluídas (working tree, sem commit).
```

**Halt final** — task avulsa, ou última task da feature:

```markdown
### Próximos passos
- **"Complete"** — commito na `master`, faço push e encerro. Este é o único ponto em que o git
  roda.
- **"Ajustar: <descrição>"** — itero e repito o halt sem commitar.
```

Nunca ofereça "Complete" num halt intermediário. Oferecer commit no meio da feature convida
exatamente o commit parcial que o fluxo existe para evitar.

## Seções condicionais

**Task visual** — acrescente: validação contra
protótipo, testes E2E, matriz de estados cobertos, animações, acessibilidade e divergências do
refinamento.

**Task sem input externo** — inclua a linha: *"Segurança de inputs: N/A — a task não processa
inputs externos."* A declaração é explícita; omitir a seção em
silêncio não vale.

**Premissas assumidas** — se você fechou alguma ambiguidade por conta própria (ver
`requirements-closure`), liste-as com o default escolhido e o racional. O revisor precisa poder
discordar de uma premissa antes que ela vire código consolidado.

**Refinement-runner** — deixe explícito que **nenhum arquivo em `.specs/specs/` foi criado ou
alterado**, e inclua o escopo consolidado (o que entra, o que não entra, critérios de aceite) que
substitui o documento de spec.

## O diff a revisar

Em qualquer modo de feature, o diff é **todo o working tree** — não há commit parcial para separar
as tasks.

**Feature sem pausa:** o halt acontece uma vez só, ao fim da última task, e o relatório traz uma
seção por task executada.

**Feature com pausa:** cada halt intermediário cobre **só a task recém-concluída** (é isso que
torna a revisão gerenciável), e o halt final resume as tasks anteriores em uma linha cada, detalha
a última e aponta o diff acumulado para a revisão de conjunto.
