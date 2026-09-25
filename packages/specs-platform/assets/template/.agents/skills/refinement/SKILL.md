---
name: refinement
description: Transforma uma descrição livre em task ou feature documentada em `.specs/specs/` — contextualiza com as features existentes, valida contra o código real, fecha os requisitos sem deixar ambiguidade em silêncio e entrega uma spec pronta para o feature-runner executar. Carregue ao refinar, detalhar, especificar, quebrar ou planejar uma atividade do projeto.
---

# refinement

Transforma uma descrição vaga em documentação **acionável, detalhada e alinhada com o estado real
do projeto** — pronta para o `feature-runner` executar.

Equivalências de tools Claude Code ↔ Cursor: `.agents/RUNTIME.md`.

## Princípios invioláveis

1. **Nunca altere código de produção.** Seu output é documentação em `.specs/specs/`. Leia o código
   à vontade; não o modifique.
2. **Sempre valide contra o estado real.** `Glob`, `Grep` e `Read` antes de referenciar qualquer
   rota, componente, tipo ou tabela em critério de aceite. Siga a cadeia de verificação de
   conhecimento da skill `requirements-closure` (código → docs → context7 → web → declarar
   incerteza). **Nunca fabrique** API, campo ou comportamento — requisito inventado vira teste que
   passa provando a coisa errada.
3. **Sempre pergunte** diante de ambiguidade real de escopo, prioridade ou encaixe:
   `AskUserQuestion` / `AskQuestion` com 2–4 opções concretas, recomendando uma quando tiver
   opinião informada ("(Recomendado)").
4. **Respeite as convenções** de `CLAUDE.md` (raiz), `.specs/specs/CLAUDE.md` e dos `CLAUDE.md` das
   apps. Nunca invente formato novo.
5. **Opere com paths absolutos** e **responda em português brasileiro**.
6. **Não commite nem crie branches.**
7. **Não altere o `status` de uma task** — isso é do `feature-runner`.

## Skills por camada

`spec-writing` (contrato do arquivo) e `requirements-closure` (como o critério é escrito e quando
está fechado) são **obrigatórias** — carregue as duas antes de redigir qualquer critério. As demais,
conforme o que a task toca:

| Carregue | Quando |
|---|---|
| `test-strategy` | a task produz código testável — define `**Tipo:**` e `**Gate:**` do bloco de Testes. Quase sempre |
| `input-security` | a task recebe input do usuário (formulário, body, query/path param, cookie, header, upload, webhook) (opcional — só se o projeto adotar essa skill) |
| `ui-standards` | a task cria ou altera tela/componente (opcional — só se o projeto adotar essa skill) |
| `prototype-check` | a task tem entregável visual — define como identificar a ferramenta e consultar o protótipo |

Não carregue o que não vai usar.

## Fluxo

**0. Protótipo (quando o usuário fornecer node IDs).** Consulta ao protótipo é **bloqueante**, antes
de ler código. Carregue `prototype-check` e siga o fluxo de delegação de lá. Conexão falhou ou os
nós não retornaram ⇒ **PARE e informe o usuário**.

**1. Entender a atividade.** Fixe **o quê** (funcionalidade, melhoria, correção), **por quê**
(problema que resolve) e **onde** (frontend, backend, ambos, infra, docs). Descrição vaga do tipo
"melhorar a performance" ⇒ `AskUserQuestion` para delimitar parte do sistema, comportamento atual
vs. esperado e restrições.

**2. Mapear o terreno.** → [mapear-terreno.md](references/mapear-terreno.md)

**3. Decidir a estrutura.** → [estrutura.md](references/estrutura.md)

**4. Fechar os requisitos.** → skill `requirements-closure`: o sweep das 9 dimensões implícitas
(cada uma vira requisito **ou** `N/A porque <motivo>` — nunca em branco), a redação em EARS, os IDs
de requisito e o portão de fechamento. **Esta fase não é opcional em task média ou grande.** O que
não foi resolvido com o usuário vira linha na tabela de premissas, nunca sumiço silencioso.

**5. Redigir.** Use `.specs/specs/_templates/` como ponto de partida, adaptando ao escopo real (não
copie seção que não se aplica). Siga `spec-writing` para estrutura, diagrama, blocos `<details>` e
frontmatter. Depois de escrever, atualize o `meta.json` correspondente — e o `overview.md` da
feature quando a task nova mudar o desenho macro.

**6. Validar.** → [validar-renderizacao.md](references/validar-renderizacao.md)

**7. Reportar.** → formato abaixo.

Leia cada referência **por completo** no momento em que a fase começa.

## Regras que valem sempre ao redigir

- Task com input do usuário **tem** bloco de segurança. Sem input, o relatório declara
  "Segurança de inputs: N/A — a task não processa inputs externos".
- Task de frontend **tem** blocos de responsividade, estados de UI e acessibilidade/animações.
- Decisão que depende de versão de lib (ver a stack no `project.md`): consulte a doc atual via
  sub-agente com MCP `context7` antes de fixar o critério, e registre a referência no relatório.
- **Nada de token visual fixo** (hex, px, pesos) — eles vivem no protótipo, não na spec.
- Decisão que vira restrição de projeto (outra feature precisaria saber dela) ⇒ proponha ao usuário
  uma entrada `AD-NNN` em `.specs/STATE.md`. Decisão feature-local fica no arquivo da task.

## Relatório

```markdown
## Refinamento concluído

**Tipo:** <Nova task em feature existente | Nova feature | Refinamento de task existente>
**Feature:** <título> (`.specs/specs/<slug>/`)
**Task(s) criada(s)/refinada(s):**
- `feat-<slug>-<task>.md` — <descrição curta>

### Resumo do escopo
- <bullet>

### Sweep das dimensões implícitas
- <dimensão> → <requisito criado | N/A porque ...>

### Premissas registradas
- <premissa> — default: <o que vamos fazer> — <racional>

### Arquivos criados/modificados
- <path> (criado/editado)

### Dependências identificadas
- <task X> (status) — <relação>

### Decisões tomadas
- <decisão e motivo, ou "nenhuma — tudo estava claro">

### Validação
- `node .agents/scripts/validate-spec.mjs <path>` — <0 erros / o que foi corrigido>
- Renderização conferida em `/features/<slug>/<task>` — <ok / o que falhou>

### Pontos que merecem atenção
- <risco, ambiguidade remanescente ou sugestão de split>

### Próximos passos
- Para **executar**: `executar feat-<slug>-<task>`
- Para **ajustar**: "Ajustar: <o que mudar>"
```

**Entrada "Ajustar: ..."** ⇒ releia o arquivo com `Read` antes de editar, aplique **apenas** o
solicitado (não expanda escopo) e volte ao relatório atualizado.

## Notas

- Chame tools em paralelo quando forem independentes (leituras, greps).
- Seja específico: o `feature-runner` usa seus critérios como spec de implementação.
- Gap descoberto no projeto (tipo compartilhado que falta, endpoint que deveria existir) vira
  **ponto de atenção** no relatório — não expanda o escopo por conta própria.
