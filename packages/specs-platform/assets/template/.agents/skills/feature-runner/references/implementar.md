# Implementar

## 1. Marcar `in-progress`

`Edit` no frontmatter da task: `status: pending` → `status: in-progress`. **Não commite** — a
mudança entra no commit final. Não mexa no `meta.json`.

## 2. Declarar o plano antes de escrever código

Antes da primeira edição, diga explicitamente:

- **Premissas** — o que você está assumindo; qualquer incerteza restante;
- **Arquivos a tocar** — só os que a task exige;
- **Como vai verificar** — qual gate, qual comando, o que prova que funcionou.

Não prossiga sem isso. É o que impede a implementação de crescer sem controle.

## 3. Testes antes da implementação

Se a task produz código com tipo de teste exigido (ver matriz da skill `test-strategy`):

1. Escreva os testes **derivados dos critérios de aceite da spec**, não do código.
2. Cada critério vira pelo menos uma asserção cujo **valor afirmado** é o desfecho que a spec
   define.
3. Onde a spec não define valor preciso, registre como **lacuna de precisão** e pergunte — nunca
   escreva asserção vaga que passa em silêncio.
4. Casos de borda listados na spec viram casos de teste.

**Restrições duras (integridade de teste):** nunca enfraqueça asserção, nunca delete ou pule caso
de teste, nunca use `.skip`/`.todo` para contornar vermelho. Teste genuinamente errado ⇒ **pare e
pergunte** antes de mexer.

## 4. Implementar

Satisfaça o **Escopo** e os **critérios de aceite** dos blocos do detalhamento técnico. Escreva o
mínimo que passa nos testes e atende ao gate — melhoria estrutural fica para task de refactor.

As convenções (formatação, tipagem, reuso antes de criação, idioma do código, política de
comentários, tools de edição) estão na skill `execution-protocol`.

**Frontend:** consulte o protótipo antes de implementar, conforme `prototype-check`. Se o projeto
adotar as skills `ui-standards` e `input-security`, siga-as também.

## 5. Gate

Rode o gate do pacote tocado, com o comando que o `project.md` define para o nível do gate
(ver a skill `test-strategy`).

Saída ≠ 0 ⇒ **pare, corrija, rode de novo**. Não siga com vermelho. Confira que a contagem de
testes não caiu.

O comando de lint + format ao final é barato e recomendado. O build completo do repositório só
quando a task exigir — é caro em monorepo. Ambos estão no `project.md`.

## 6. Revisão pós-gate

1. **Test Adequacy Review** (skill `test-strategy`, Checks A–D): cobertura com `file:line`,
   litmus anti-raso, mapeamento reverso, conformidade. Qualquer falha ⇒ reescreva e rode o gate de
   novo.
2. **Divergiu da spec?** marque no código:
   ```ts
   // SPEC_DEVIATION: <o que divergiu>
   // Motivo: <por que foi necessário>
   ```
   e registre no relatório de halt.
3. **Complexidade:** um engenheiro sênior chamaria isso de complicado demais? Sim ⇒ simplifique e
   rode o gate de novo.
4. **Escopo:** você tocou algum arquivo que não estava no plano do passo 2? Se sim, justifique no
   relatório ou reverta.

## 7. Guarda de escopo durante a implementação

Você vai notar coisas que dariam para melhorar. **Não aja sobre elas.**

- **Bug** ⇒ traga para o usuário no relatório, ou registre como task separada.
- **Melhoria** ⇒ vira "ponto de atenção" no relatório.
- **Relacionado à task atual** ⇒ só entra se estiver nos critérios de aceite.

Nunca "já que estou aqui". Scope creep durante a implementação é o principal destruidor de
qualidade de review.
