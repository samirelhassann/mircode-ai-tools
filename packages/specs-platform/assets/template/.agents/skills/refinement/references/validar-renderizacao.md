# Validar

Duas checagens. Nenhuma é opcional — erro de frontmatter, slug inconsistente ou typo no `meta.json`
quebra a página na Specs Platform.

## 1. Validação determinística

```bash
node .agents/scripts/validate-spec.mjs .specs/specs/<slug>/feat-<slug>-<task>.md
```

Checa por código o que a skill `spec-writing` exige de memória: frontmatter e `status` válido,
ordem das seções, ausência de H1 no corpo, `**Depende de:**`, `### Fora de escopo`, os quatro
`classDef` do Mermaid, linha em branco nos `<details>`, heading proibido dentro de `<details>`,
critério fora de EARS, ID de requisito malformado, premissa com célula vazia, e presença do arquivo
em `pages` do `meta.json`.

**Saída ≠ 0 ⇒ corrija antes de apresentar.** Rode no arquivo que você tocou; `--all` existe para
inventário e hoje acusa as specs no formato antigo, que não são escopo do seu refinamento.

## 2. Renderização

1. `curl -sf http://localhost:4321/health` (UI e API na mesma porta). Não respondeu? rode
   `specs status`; se não estiver no ar, peça ao usuário para rodar `specs start` na raiz.
2. Abra as páginas criadas/editadas (`/features/<slug>` e `/features/<slug>/feat-<slug>-<task>`) —
   via sub-agente com a ferramenta de E2E, ou pelos endpoints `/api/tree` e `/api/content`.
3. Confirme: sem erro de console, título e seções renderizando, diagrama Mermaid sem erro, blocos
   expansíveis abrindo, sidebar na ordem certa.
4. Falhou algo? consulte a seção **Troubleshooting** de `SPECS.md` antes de mexer na configuração.
