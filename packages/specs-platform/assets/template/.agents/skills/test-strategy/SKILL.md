---
name: test-strategy
description: Estratégia de testes do projeto — matriz de cobertura por camada, os três níveis de gate (rápido/completo/build), co-location de teste na mesma task, o Test Adequacy Review (suficiente, não-raso, necessário, conforme) e a tabela de trapaças de verificação. Carregue ao refinar uma task que produz código testável e antes de fechar qualquer task de implementação.
---

# Estratégia de testes

Duas regras governam tudo aqui:

1. **O teste deriva da spec, nunca da implementação.** Escrever teste lendo o código e afirmando
   o que ele já faz não prova nada — congela o bug junto com o comportamento.
2. **Quem decide se a task passou é o runner, não o agente.** "Parece correto" não fecha task.
   Gate verde fecha.

## Matriz de cobertura por camada

A matriz concreta — camada, tipo de teste, onde o teste mora e qual comando roda — está em
[`.agents/project.md`](../../project.md), seção **Pacotes, testes e comandos**. Leia-a antes de
decidir o tipo de teste de qualquer task.

O que a matriz não dita, e vale em qualquer projeto:

| Camada | Expectativa de profundidade |
|---|---|
| Use case / regra de negócio | 1:1 com os critérios de aceite; todo caminho triste listado tem teste |
| Adapter / repositório | caminhos de query principais + tratamento de erro |
| Rota / controller | toda rota tocada: feliz + cada caso listado + cada erro documentado |
| Utilitário compartilhado | todos os ramos; em módulo de segurança, 1 caso positivo + 1 malicioso por função |
| Lib / hook / helper puro | todos os ramos da função |
| Tela / componente | fluxo feliz + erro + vazio, em cada breakpoint declarado |
| Entidade, DTO, tipo, config, schema | nenhum teste próprio — só o gate de build |

**A matriz é piso, não teto.** O alvo de profundidade vem dos critérios de aceite da task, não do
que o repositório já tem. Mas nunca produza teste **menos** rigoroso que os existentes na mesma
camada — o `project.md` indica qual módulo serve de referência de rigor.

## Os três gates

| Nível | Quando |
|---|---|
| **rápido** | task com teste unitário no pacote tocado |
| **completo** | task com teste de integração/contrato, ou que toca 2+ pacotes |
| **build** | última task da feature, ou task só de config/entidade/tipo |

Os comandos de cada nível estão em [`.agents/project.md`](../../project.md), seção **Pacotes,
testes e comandos** — incluindo a flag obrigatória do runner e qual comando roda o repositório
inteiro.

Regras do gate:

- **Filtre pelo pacote tocado.** Rodar o repositório inteiro é caro; só o gate build da última
  task justifica esse custo, e ainda assim prefira filtrar.
- **Use a flag de execução única** que o `project.md` indica — sem ela o runner entra em watch mode
  e trava o agente.
- **Saída ≠ 0 = pare.** Corrija, rode de novo, não siga. Não existe "sigo e arrumo depois".
- **Confira a contagem de testes** antes e depois. Caiu? algum teste foi deletado ou pulado —
  investigue antes de qualquer coisa.
- Task que não produz código testável (doc, config, tipo) declara `Gate: build` e roda o comando de
  build do `project.md`.

No refinamento, cada task declara os dois campos num bloco `<details>` de Testes:

```markdown
<details>
<summary>Testes</summary>

**Tipo:** unit · **Gate:** rápido (`<comando do pacote tocado, ver project.md>`)

- [ ] `create-user-use-case.test.ts` cobre CADASTRO-01 a CADASTRO-04
- [ ] caso malicioso por campo sanitizado

</details>
```

## Co-location: o teste é da mesma task

Task que cria ou altera camada com tipo de teste exigido **escreve esses testes na própria task**.
Teste nunca é task separada.

"Vai ser testado na task seguinte" é **adiamento de teste** — exatamente o anti-padrão que esta
regra existe para impedir. Se o código de uma task só fica testável depois de outra, o recorte das
tasks está errado. Resolva assim:

- **Junte para a frente:** mova os testes para a primeira task em que eles rodam (ex.: a task de
  wiring inclui o wiring **e** os testes de contrato da rota que ela habilita).
- **Junte para trás:** absorva a dependência bloqueante na task atual (ex.: a task da rota inclui o
  próprio registro no módulo).

Escolha o que mantiver as tasks atômicas e coesas. O objetivo é único: **nenhuma task produz código
não verificado.**

## Integridade de teste — restrições duras

Nunca, em nenhuma circunstância:

- enfraquecer uma asserção para ela passar;
- deletar um caso de teste para reduzir falha;
- usar `.skip`, `.todo`, `it.skip`, `describe.skip` ou equivalente para contornar teste vermelho;
- alterar o teste depois para acomodar a implementação.

Teste genuinamente errado (afirma comportamento que contraria a spec)? **pare e pergunte** antes de
mexer. O teste é a spec executável; a implementação se conforma a ele, não o contrário.

## Test Adequacy Review

Roda **antes de fechar a task** (antes do halt, no `feature-runner`/`refinement-runner`). Quatro
checagens; qualquer uma falha = reescreva e rode o gate de novo.

### A — Suficiente (cobertura com evidência)

Monte a tabela. **Evidence-or-zero:** critério sem `file:line` **e** sem a expressão da asserção
conta como **NÃO coberto**. Não declare um critério ausente sem antes procurar — mostre a busca.

| Critério (ID EARS) | `file:line` + asserção | Desfecho definido na spec | Coberto? |
|---|---|---|---|
| CADASTRO-03 | `tests/unit/auth-use-cases.test.ts:88` — `expect(res.errorCode).toBe('CPF_ALREADY_REGISTERED')` | 409 + `CPF_ALREADY_REGISTERED` | ✅ |
| CADASTRO-05 | — | não definido precisamente na spec | ⚠️ lacuna de precisão |

**Checagem ancorada na spec:** não basta existir asserção — o **valor afirmado** tem que ser o
desfecho que a spec define. Onde a spec não define valor preciso, marque `⚠️ lacuna de precisão` e
registre; nunca passe asserção vaga como se fosse cobertura.

### B — Não-raso (litmus)

Rejeite:

- teste sem asserção, ou tautologia (`expect(true).toBe(true)`);
- "não lançou erro" como única asserção — salvo quando não lançar **é** o comportamento especificado;
- asserção só na contagem de chamadas do mock quando o critério exige o resultado;
- só caminho feliz quando a task lista caso de erro ou de borda.

**Regra do payload/conjunção.** Para cada campo nomeado de um evento emitido, objeto retornado ou
registro persistido: (1) abra o objeto construído no `file:line`; (2) confirme que a asserção mira
o **valor ou estado** do campo, não a chamada que o produziu; (3) `emit(...)` / `save(...)` presente
não prova o campo — só a asserção sobre o resultado prova; (4) afirmar que um método foi chamado
≠ afirmar o estado resultante. Os dois podem ser necessários; nenhum substitui o outro.

**Litmus geral:** a asserção é rasa se **passaria com uma implementação plausivelmente errada**.
Passou nesse teste? fortaleça antes de commitar.

### C — Necessário (mapeamento reverso)

Todo teste mapeia de volta para um critério de aceite, um caso de borda listado ou um item do
escopo. O que não mapeia para nada → **remova**.

| `file:line` + asserção | Mapeia para | Manter? |
|---|---|---|
| `tests/unit/cpf.test.ts:12` — `expect(isValidCpf('...')).toBe(false)` | CADASTRO-02 | ✅ |

Não escreva teste especulativo "e se...", não teste comportamento de framework ou de biblioteca, e
não duplique numa camada a asserção que outra camada já faz para o mesmo cenário.

### D — Conforme

Os testes seguem as convenções do repositório — nome do arquivo, path, idioma do código e runner
estão em [`.agents/project.md`](../../project.md). Cite no relatório qual convenção seguiu.

**Limite:** o teste prova o trabalho, não o expande. O repositório é o **piso** de rigor; os
critérios de aceite são o **teto** de escopo. Não invente requisito nem teste sem âncora.

## Trapaças de verificação (falha automática)

| Trapaça | Por que falha |
|---|---|
| Fechar a task antes do gate passar | pula o verificador determinístico; o gate não é opcional |
| Afirmar contagem de chamada em vez do estado resultante | prova que o método rodou, não que fez a coisa certa |
| Marcar critério coberto sem citar `file:line` | viola evidence-or-zero; suspeita de cobertura não é cobertura |
| Enfraquecer asserção para forçar o verde | move a trave em vez de consertar o código |
| Deletar ou pular teste para a suíte passar | destrói cobertura permanentemente; teste vermelho é sinal, não ruído |
| "Testado em outro lugar" sem citar onde | lacuna escondida atrás de afirmação vaga |
| Teste especulativo sem âncora em critério | expande escopo além do teto; remova no Check C |
| Testar comportamento de framework/lib | testa dependência, não a feature; remova no Check C |

Esta review é inspeção — julgamento de modelo. Ela **complementa** o gate (que prova que a suíte
roda) e o sensor de discriminação da skill `verification` (que prova que a suíte detecta
regressão). Nenhuma das três substitui as outras.
