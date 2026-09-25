---
title: "Frontend"
description: "<Descrição curta do que essa tarefa entrega na camada de UI.>"
status: pending
---

## Contexto da alteração

<Por que esta task existe: qual tela/fluxo existe hoje, o que passa a existir e o que o usuário
ganha com isso. 2 a 4 parágrafos curtos, sem detalhe de implementação.>

**Depende de:**

- [<Título da task>](./feat-<slug>-<task>.md) — <o que ela entrega para esta>

## Visão Técnica

```mermaid
flowchart TB
  A["<Página/componente alterado>"]:::changed
  B["<Componente novo>"]:::added
  C["<Componente removido>"]:::removed
  D["<API/DAL consumida, inalterada>"]:::untouched
  D --> A --> B

  classDef changed fill:#3b2f00,stroke:#eab308,color:#fde68a
  classDef added fill:#052e1a,stroke:#22c55e,color:#bbf7d0
  classDef removed fill:#3b0d0d,stroke:#ef4444,color:#fecaca
  classDef untouched fill:#151515,stroke:#2a2a2a,color:#9ca3af
```

> 🟡 alterado · 🟢 adicionado · 🔴 removido · ⚪ inalterado (contexto)

### O que muda, em resumo

| # | Mudança | Efeito |
|---|---------|--------|
| 1 | <mudança> | <efeito prático para o usuário> |

### Detalhamento técnico

<details>
<summary><Seção/componente 1></summary>

<Estrutura, hierarquia e comportamento + critérios de aceite.>

- [ ] ...

</details>

<details>
<summary>Responsividade (Desktop · Tablet · Mobile)</summary>

- [ ] ...

</details>

<details>
<summary>Estados de UI — loading, erro, vazio</summary>

- [ ] ...

</details>

<details>
<summary>Acessibilidade e animações</summary>

- [ ] ...

</details>

<details>
<summary>Testes E2E</summary>

- [ ] ...

</details>

## Escopo

- ...

### Fora de escopo

- ...

## Code Review Checklist

- [ ] ...
