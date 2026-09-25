---
title: "Integração"
description: "<Descrição curta da integração front↔back e validação fim-a-fim.>"
status: pending
---

## Contexto da alteração

<Que pontas já existem separadas, o que falta ligar e como fica o fluxo completo depois.>

**Depende de:**

- [<Feature> — Frontend](./feat-<slug>-frontend.md) — <o que entrega>
- [<Feature> — Backend](./feat-<slug>-backend.md) — <o que entrega>

## Visão Técnica

```mermaid
flowchart LR
  FE["<Tela/componente>"]:::changed
  API["<Cliente HTTP em api/>"]:::added
  BE["<Endpoint>"]:::untouched
  FE --> API --> BE

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
<summary>Wire frontend ↔ backend</summary>

- [ ] ...

</details>

<details>
<summary>Cenários E2E</summary>

- [ ] ...

</details>

<details>
<summary>Validações manuais</summary>

- [ ] ...

</details>

## Escopo

- ...

### Fora de escopo

- ...

## Code Review Checklist

- [ ] ...
