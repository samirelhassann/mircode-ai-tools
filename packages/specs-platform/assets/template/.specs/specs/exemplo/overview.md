---
title: "Feature de exemplo"
description: "Página de overview da feature — é isto que aparece ao clicar na feature na sidebar, antes de entrar em qualquer task."
---

## O que será feito

Este arquivo é o **overview da feature**: mora em `.specs/specs/<slug>/overview.md` e é renderizado
na rota `/features/<slug>`. Se ele não existir, a plataforma continua redirecionando para a
primeira task — nada quebra.

Use este espaço para a **visão macro**: o problema, a decisão tomada e o desenho geral da solução.
O detalhe de cada recorte vive nas tasks.

## Visão Técnica

O diagrama do overview mostra a arquitetura macro da feature inteira; o diagrama de cada task
mostra o recorte micro daquela task. Ambos usam as mesmas cores.

```mermaid
flowchart TB
  subgraph camada["Camada de exemplo"]
    direction LR
    A["<Componente alterado>"]:::changed
    B["<Componente novo>"]:::added
    D["<Componente inalterado>"]:::untouched
    D --> A --> B
  end

  subgraph morto["Aposentado nesta feature"]
    C["<Componente removido>"]:::removed
  end

  classDef changed fill:#3b2f00,stroke:#eab308,color:#fde68a
  classDef added fill:#052e1a,stroke:#22c55e,color:#bbf7d0
  classDef removed fill:#3b0d0d,stroke:#ef4444,color:#fecaca
  classDef untouched fill:#151515,stroke:#2a2a2a,color:#9ca3af
```

> 🟡 alterado · 🟢 adicionado · 🔴 removido · ⚪ inalterado (contexto)

### Ordem de execução

Descreva a cadeia crítica entre as tasks — o que bloqueia o quê e o que pode andar em paralelo.
A lista de tasks com status aparece automaticamente abaixo desta página.
