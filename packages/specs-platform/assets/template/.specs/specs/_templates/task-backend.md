---
title: "Backend"
description: "<Descrição curta do que essa tarefa entrega na camada de API/serviço.>"
status: pending
---

## Contexto da alteração

<Por que esta task existe: como funciona hoje, o que passa a funcionar diferente e o que o
usuário percebe (ou não percebe). 2 a 4 parágrafos curtos, sem detalhe de implementação.>

**Depende de:**

- [<Título da task>](./feat-<slug>-<task>.md) — <o que ela entrega para esta>

## Visão Técnica

```mermaid
flowchart TB
  A["<Componente alterado>"]:::changed
  B["<Componente novo>"]:::added
  C["<Componente removido>"]:::removed
  D["<Componente inalterado, só contexto>"]:::untouched
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
| 1 | <mudança> | <efeito prático> |

### Detalhamento técnico

<details>
<summary><Recorte 1 — ex: Endpoint, Regra de negócio, Persistência></summary>

<Explicação do recorte seguida dos critérios de aceite verificáveis dele.>

- [ ] ...

</details>

<details>
<summary>Segurança e sanitização de inputs</summary>

- [ ] ...

</details>

<details>
<summary>Testes</summary>

- [ ] ...

</details>

## Escopo

- ...

### Fora de escopo

- ...

## Code Review Checklist

- [ ] ...
