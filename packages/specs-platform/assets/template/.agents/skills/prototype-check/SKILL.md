---
name: prototype-check
description: Como consultar o protótipo do projeto antes de escrever ou implementar qualquer entregável visual — primeiro identificando a ferramenta (Claude Design ou Pencil) pelo bloco `prototype` do `.specs/config.json`, e só então aplicando o fluxo daquela ferramenta (abrir o canvas e ler as notas no Claude Design; Pencil MCP, node IDs e breakpoints no Pencil). Carregue em qualquer task que crie ou altere tela, componente visual ou fluxo de UI.
---

# Consulta ao protótipo

A consulta é **bloqueante**: sem protótipo conferido, não se escreve critério de aceite visual nem
se implementa tela. Mas o *como* muda conforme a ferramenta — então a primeira coisa a fazer nunca
é abrir o protótipo, e sim **descobrir qual ferramenta o projeto usa**.

## Passo 1 — Identificar a ferramenta (sempre primeiro)

Leia o bloco `prototype` do `.specs/config.json`:

```json
{
  "prototype": {
    "tool": "claude-design",
    "title": "Finance — redesign",
    "url": "https://claude.ai/code/artifact/<id>",
    "designDir": "design/finance-redesign",
    "artboards": ["Desktop", "Mobile", "Loading"]
  }
}
```

- `tool: "claude-design"` → canvas do Claude Design, endereçado por `url`.
- `tool: "pencil"` → arquivo `.pen` local, endereçado por `file` (e opcionalmente `nodeIds`).
- Bloco ausente ou `null` → **o projeto não tem protótipo**: siga sem fase visual e diga isso no
  relatório. Não invente um.

O `meta.json` da feature pode declarar o seu próprio bloco `prototype`, e ele **substitui** o do
projeto por completo — uma feature pode estar em outra ferramenta que o resto do repositório.
Cheque o `meta.json` da feature antes de assumir o default.

Sem bloco algum e com suspeita de que existe protótipo, confirme por heurística **e depois peça ao
usuário para declarar**: `.pen` versionado ⇒ Pencil; `design/**/README.md` com link
`claude.ai/code/artifact` ⇒ Claude Design.

## Passo 2A — Claude Design

O canvas é a fonte da verdade; ele **não vive no repositório** e não há MCP para lê-lo.

1. Abra a `url` (ou peça ao usuário que abra e descreva/exporte o artboard em questão). Na Specs
   Platform, o painel **Protótipo** da task já traz o botão que abre o canvas.
2. Leia `<designDir>/README.md` — é onde ficam registradas as decisões de design, os artboards, os
   estados de erro/vazio e o mapa de componentes. É a parte versionada do protótipo, e a única
   consultável offline.
3. Confira, para a tela da task: estrutura e hierarquia; estados (loading, erro, vazio); os
   breakpoints que o protótipo cobre; e quais componentes do design system entram.
4. **Não há node ID no Claude Design.** Referencie os artboards pelo nome ("Finance · Mobile"),
   nunca por id inventado.
5. Alterações no protótipo se pedem pelo slash command `/design` do Claude Code — é o mesmo caminho
   do botão "Pedir alteração" da Specs Platform. Nunca edite o canvas por outro meio.
6. A Specs Platform embute o protótipo a partir de um **snapshot local** (`prototype.snapshot`,
   default `<designDir>/canvas.html`) — o canvas publicado recusa iframe cross-origin. Depois de
   alterar o design, regrave esse arquivo: leia o canvas com a tool `Artifact` (`action: "read"`) e
   grave o HTML devolvido no caminho do snapshot. É o que o botão **Sincronizar** faz.

Divergência entre o README e o canvas: o **canvas ganha**, e o README deve ser atualizado na mesma
task.

## Passo 2B — Pencil

O `.pen` é **encriptado**: nunca use `Read`/`Grep` nele. Só as tools do Pencil MCP.

As tools `pencil` normalmente **não estão disponíveis dentro de subagentes de execução** — delegue
a consulta a um sub-agente que as tenha, ou faça-a na sessão principal antes de delegar.

1. Confirme a conexão e o arquivo aberto (estado do editor).
2. **Obtenha os node IDs** dos nós relevantes: se o `meta.json`/`config.json` declarar `nodeIds`,
   parta deles; senão, localize os nós por busca semântica pelo nome da tela/componente e confirme
   com o usuário quais são os alvos antes de seguir.
3. Para cada nó alvo, extraia: estrutura e hierarquia, tokens (cores, espaçamentos, tipografia),
   estados e os **3 breakpoints** (desktop, tablet, mobile).
4. Registre os node IDs consultados no relatório — é o que torna a consulta auditável.
5. Alterações se pedem pelo mesmo MCP, devolvendo o antes/depois de cada nó afetado.

## Regras comuns

- **Nada de tokens fixos na spec** (hex, px, pesos): eles mudam no protótipo e a doc passa a
  mentir. Descreva estrutura e intenção; quem implementa extrai os valores no momento da
  implementação.
- Tela que deveria existir e não está no protótipo: **pare e informe o usuário**. Não desenhe por
  conta própria.
- No relatório da task, inclua uma seção **Validação contra o protótipo** com a ferramenta usada, o
  que foi conferido (✅/❌) e — no Pencil — os node IDs.
- Ferramenta indisponível, sem resposta ou falhando após 2–3 tentativas: **pare e informe**, não
  siga por aproximação.
