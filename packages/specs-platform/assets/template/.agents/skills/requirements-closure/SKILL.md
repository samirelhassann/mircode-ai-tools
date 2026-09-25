---
name: requirements-closure
description: Como fechar requisitos sem deixar ambiguidade em silêncio — notação EARS para critérios de aceite, IDs de requisito rastreáveis, o sweep das 9 dimensões implícitas (validação, falha parcial, idempotência, auth/rate-limit, concorrência, ciclo de vida do dado, observabilidade, falha de dependência externa, transição de estado), o portão de fechamento e a tabela de premissas. Carregue antes de redigir critérios de aceite em qualquer refinamento, com ou sem spec escrita.
---

# Fechamento de requisitos

Esta skill responde a uma pergunta só: **este requisito pode ser lido de duas formas?** Enquanto
puder, ele não está pronto — nem para virar spec, nem para virar código.

Vale para quem escreve spec (`refinement`) e para quem fecha escopo de cabeça (`refinement-runner`).
O `spec-writing` diz *onde* o critério mora no arquivo; esta skill diz *como ele é escrito e quando
está completo*.

## Fatos você descobre, decisões você pergunta

Antes de perguntar qualquer coisa ao usuário, resolva sozinho tudo que é descobrível lendo o
ambiente. Pergunta que o código já responde queima a atenção dele e um turno.

**Cadeia de verificação de conhecimento** — em ordem estrita, nunca pule para o passo 5:

```
1. Código      → o que já existe, convenções e padrões em uso no monorepo
2. Docs        → CLAUDE.md (raiz e apps), .specs/specs/, .specs/discoveries/, .specs/STATE.md
3. Context7    → doc atual da lib (subagente com MCP context7) quando a decisão depende de versão
4. Busca web   → doc oficial, fonte reputada
5. Declarar incerteza → "não tenho certeza sobre X — meu raciocínio é Y, confirme"
```

**Nunca invente.** API, comportamento de lib, nome de campo, formato de payload: não achou? diga
"não sei" ou "não encontrei documentação". Requisito fabricado se propaga para o critério de
aceite, para o teste e para o código — e o teste passa provando a coisa errada.

Reserve as perguntas para o que é genuinamente decisão do usuário: escopo, prioridade,
comportamento de produto, trade-off, o que fazer no caminho triste.

## O que é critério de aceite, e o que não é

Antes de escrever, decida **se aquilo é critério**. EARS não protege contra isso: dá para escrever
"QUANDO o body é validado ENTÃO o schema DEVE usar `.strict()`" — está em EARS e continua sendo
decisão de estrutura interna, não entrega.

**Critério de aceite é comportamento observável na fronteira da entrega:** resposta de API, o que
aparece na tela, o que fica persistido, invariante que precisa valer. Ele descreve **o que a
entrega faz**, não como ela é por dentro.

### O teste do refactor

> **Se eu refatorar sem mudar comportamento, esse item quebra?**
> Sim ⇒ **não é critério de aceite.** É nota de implementação ou item de code review.

Um segundo teste, equivalente: *um teste que desconhece a implementação consegue provar isso?* Se
a única forma de "verificar" é abrir o arquivo e olhar, é inspeção — e inspeção mora na
`## Code Review Checklist`.

| Não é critério (vai para a Code Review Checklist) | É critério (fica no bloco `<details>`) |
|---|---|
| `CreateQueryRequestDTO` ganha `objective?: QueryObjective` | QUANDO `POST /queries` recebe body sem `objective` ENTÃO o sistema DEVE persistir `BUY` |
| O schema do controller segue `.strict()` | SE o body traz campo desconhecido ENTÃO o sistema DEVE responder 400 sem processar a requisição |
| A entidade não expõe setter para o campo | QUANDO uma query `COMPLETED` é reprocessada ENTÃO o sistema DEVE manter o `objective` original |
| Teste mora em `__tests__/unit/useCases/...` | O sistema DEVE cobrar o mesmo preço para a mesma placa e SKU, qualquer que seja o `objective` |
| Nenhum índice novo na tabela | O sistema DEVE manter o parâmetro fora da chave de cache e de dedupe |

Repare no padrão: a coluna da direita sobrevive a renomear DTO, mover arquivo e trocar ORM. A da
esquerda não.

### A exceção: quando a estrutura é a entrega

A regra não é "nunca cite arquivo". É *a estrutura é o produto, ou o caminho até ele?*

Numa task cuja entrega **é** a migration, `coluna objective com default BUY, sem backfill` é o
desfecho — é o que o usuário da task está pedindo, e um teste de schema prova. Numa task de caso de
uso, a mesma frase é detalhe de como você escolheu persistir.

Na dúvida, pergunte: **se isso mudar, o consumidor da entrega percebe?** Sim ⇒ critério.

### Por que isso importa aqui

1. **O Verifier exige evidência.** A skill `verification` cobra `file:line` + a expressão da
   asserção para cada critério. Nota de implementação não tem asserção que prove valor — ela
   entope a tabela de cobertura com linhas que nunca fecham.
2. **Critério estrutural envelhece rápido.** Ele quebra no primeiro refactor e a spec passa a
   mentir, o que é pior do que não ter dito nada.
3. **Hoje isso está escrito duas vezes.** Nas specs atuais, os itens de padrão aparecem no bloco
   `<details>` **e** repetidos, condensados, na `## Code Review Checklist`. Escrevendo cada coisa
   no lugar dela, a duplicação some.

## Critérios de aceite em EARS

Todo critério de aceite resolve para **exatamente um** destes padrões. O verbo **DEVE** é
obrigatório em todos — é ele que marca a linha como requisito verificável.

| Padrão | Palavra-chave | Forma | Para |
|---|---|---|---|
| Ubíquo | (nenhuma) | O sistema DEVE `<resposta>` | Invariante sempre válida |
| Dirigido a evento | QUANDO | QUANDO `<gatilho>` ENTÃO o sistema DEVE `<resposta>` | Reação a um evento discreto |
| Dirigido a estado | ENQUANTO | ENQUANTO `<estado>` o sistema DEVE `<resposta>` | Comportamento durante um estado |
| Opcional | ONDE | ONDE `<capacidade presente>` o sistema DEVE `<resposta>` | Atrás de flag ou capacidade opcional |
| Indesejado | SE / ENTÃO | SE `<condição indesejada>` ENTÃO o sistema DEVE `<resposta>` | Erro, falha, input inválido, timeout |
| Composto | combinação | ENQUANTO `<estado>`, QUANDO `<gatilho>` o sistema DEVE `<resposta>` | Comportamento mais rico |

**Por que seis padrões e não um.** Com só `QUANDO/ENTÃO`, falha e transição de estado viram nota
de rodapé em prosa. Com `SE/ENTÃO` e `ENQUANTO` de primeira classe, elas viram critério — e
critério vira teste.

Regras:

- **Um comportamento por critério.** Nunca junte dois com "e também".
- **Valor concreto, nunca advérbio.** `DEVE responder 409 com `errorCode: EMAIL_ALREADY_REGISTERED``,
  não "DEVE tratar graciosamente". "Rápido", "amigável" e "corretamente" não são verificáveis.
- **Desfecho preciso.** O critério define o valor esperado: status, campo, mensagem, estado
  persistido. Sem desfecho preciso o teste vira asserção vaga que passa com implementação errada.
- **Ancorado em código real.** Cite rota, componente, tipo e tabela que existem — salvo quando a
  task é justamente criá-los, e aí seja explícito ("Criar `POST /api/v1/vehicles`").
- **Sem token visual fixo** (hex, px, peso de fonte): vive no protótipo, não na spec.

Exemplos:

```markdown
- [ ] QUANDO o usuário submete CPF já cadastrado ENTÃO o sistema DEVE responder 409 com
      `errorCode: CPF_ALREADY_REGISTERED` e não criar registro em `users`
- [ ] SE o provedor veicular exceder 5s ENTÃO o sistema DEVE abortar a chamada, registrar
      `provider_timeout` no log e responder 504 com mensagem genérica
- [ ] ENQUANTO a consulta estiver em `processing` o sistema DEVE exibir o skeleton do relatório
      em vez do conteúdo parcial
- [ ] O sistema DEVE persistir o identificador sensível como hash truncado, nunca em claro
```

## IDs de requisito

Todo critério de aceite de task **Large** (5+ critérios ou 2+ camadas) carrega um ID rastreável.

- Formato: `<CATEGORIA>-<NN>` em maiúsculas — `CADASTRO-01`, `CONSULTA-07`, `CMS-03`.
- A categoria é derivada do slug da feature, não da task.
- Numeração sequencial por feature, **permanente**: não reaproveite número de requisito removido.
- No arquivo da task o ID prefixa o critério: `- [ ] **CADASTRO-03** — QUANDO ... ENTÃO ...`.

O ID é o que permite ao `verification` dizer "CADASTRO-03 coberto em
`tests/unit/auth-use-cases.test.ts:88`" em vez de "os testes parecem cobrir o cadastro".

Task pequena e coesa (≤4 critérios, uma camada) pode dispensar IDs. Declare isso no relatório.

## Sweep das 9 dimensões implícitas

O que mais falta em spec não é o que foi escrito errado — é o que ninguém lembrou de perguntar.
Antes de fechar o escopo, passe por **cada** dimensão abaixo. Cada uma resolve para um requisito
**ou** para um `N/A porque <motivo>` explícito. **Campo em branco é proibido.**

| Dimensão | O que cobrir |
|---|---|
| Validação e limites de input | formato, tamanho máximo, alfabeto permitido, sanitização |
| Falha e falha parcial | timeout, gravação parcial, rollback, o que o usuário vê quando quebra no meio |
| Idempotência / retry / duplicata | reenvio seguro, chave de deduplicação, clique duplo no submit |
| Fronteira de auth e rate limit | quem pode chamar, o que acontece sem token, throttle |
| Concorrência e ordenação | corrida entre requisições, garantia de ordem, lock |
| Ciclo de vida do dado | TTL, expiração, arquivamento, deleção, o que acontece com dado órfão |
| Observabilidade | o que é logado, com que nível, qual métrica, correlação de request |
| Falha de dependência externa | provedor veicular fora do ar, gateway de pagamento recusando, fallback, circuit breaker |
| Integridade de transição de estado | transições válidas, guarda contra transição ilegal, estado terminal |

Profundidade pelo tamanho da atividade:

- **Grande / complexa** (2+ camadas, contrato novo, ou 3+ tasks): **todas** as 9 dimensões,
  cada uma com requisito ou `N/A porque`.
- **Média** (uma camada, escopo claro): só as dimensões obviamente presentes no domínio da task;
  colapse o resto em uma linha `demais dimensões N/A para este escopo`.
- **Pequena** (ajuste pontual, ≤3 arquivos): pule o sweep.

O `N/A porque` é **obrigatório** e não é burocracia: é ele que impede inventar requisito só para
preencher a tabela. `Concorrência: N/A porque a operação é um GET sem efeito colateral` é uma
resposta completa.

Bound: o sweep é limitado ao escopo **desta** atividade. Ele esclarece requisito existente, nunca
inventa capacidade nova — "Fora de escopo" continua sendo o contrapeso.

> Em produto que depende de integração externa, as dimensões que mais mordem são **falha de
> dependência externa** (provedor
> veicular, gateway de pagamento), **idempotência** (webhook de pagamento reentregue) e **ciclo de
> vida do dado** (resultado em cache, identificador sensível, expiração de artefato gerado). Não
> passe batido nelas.

## Portão de fechamento (antes de apresentar o escopo)

Três checagens. Enquanto qualquer item ficar aberto e não registrado, o escopo **não** vai para
aprovação nem para implementação.

1. **Ambiguidade e precisão.** Todo critério tem uma leitura só **e** um desfecho preciso. Falhou
   em qualquer das duas: resolva com o usuário, quebre em dois critérios, ou registre como
   premissa com o default escolhido e o racional.
2. **Fechamento de questões em aberto.** Enumere toda decisão que surgiu durante o refinamento.
   Cada uma foi **resolvida com o usuário** ou virou **premissa registrada**. Nada segue sem marca.
3. **Gray area recusada vira premissa.** O que o usuário não quis discutir, ou que nem chegou a
   ser discutido, é escrito na tabela de premissas com o default do agente e o motivo — nunca
   descartado em silêncio.

Escala pelo tamanho: **grande/complexa** = portão completo; **média** = resolva as ambiguidades
óbvias e registre o resto como premissa; **pequena** = pule.

## Tabela de premissas e questões em aberto

Vive num bloco `<details>` chamado **Premissas e questões em aberto**, logo antes do bloco de
Testes (ver `spec-writing`). No `refinement-runner`, que não escreve spec, ela vai no relatório
de halt.

```markdown
<details>
<summary>Premissas e questões em aberto</summary>

| Premissa / decisão | Default escolhido | Racional | Confirmado? |
|---|---|---|---|
| Webhook reentregue pelo gateway | dedup por `providerEventId` único | o gateway não garante entrega única | não |

**Questões em aberto:** nenhuma — todas resolvidas ou registradas acima.

</details>
```

A linha `**Questões em aberto:**` é obrigatória. Se houver questão viva de verdade, liste-a e diga
a quem ela é endereçada — mas então o escopo não está fechado, e isso precisa aparecer no relatório
como bloqueio, não como nota de rodapé.

## Verificação determinística

Antes de apresentar a spec, rode:

```bash
node .agents/scripts/validate-spec.mjs .specs/specs/<slug>/feat-<slug>-<task>.md
```

Ele checa a metade estrutural deste portão — frontmatter válido, ordem das seções, ausência de H1
no corpo, linha em branco nos `<details>`, `classDef` do Mermaid, critério sem `DEVE`, premissa com
célula vazia, formato de ID de requisito. Saída ≠ 0 significa **pare e corrija** antes de
apresentar.

O script confere estrutura; o julgamento continua seu — se a interpretação está certa e se o
desfecho é preciso, só você sabe.
