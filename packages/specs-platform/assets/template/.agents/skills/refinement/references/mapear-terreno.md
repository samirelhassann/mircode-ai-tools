# Mapear o terreno

Em paralelo, antes de decidir qualquer coisa:

- **`Glob` em `.specs/specs/*/meta.json`**, lidos todos — mapa completo de features e tasks. Para
  as features relevantes, leia o `overview.md` e o frontmatter de cada task (inclusive `status`).
- **`CLAUDE.md`** da raiz, `.specs/specs/CLAUDE.md` e o `CLAUDE.md` da app afetada.
- **`.specs/STATE.md`, seção `## Decisions`** — leitura **obrigatória** antes de qualquer decisão
  arquitetural. Detalhes abaixo.
- **Código relacionado** via `Grep`/`Glob`: endpoints existentes, componentes, schema do banco,
  tipos e utilitários compartilhados (ver a estrutura de pacotes no `project.md`).
- **Dependências cruzadas:** o que é pré-requisito desta atividade e o que dependerá dela.
- **Discoveries** em `.specs/discoveries/` que toquem o assunto — referencie em vez de duplicar.

Escopo amplo demais para `Glob`/`Grep`: no máximo **1** chamada `Agent` com
`subagent_type: Explore`, com foco específico.

## Decisões ativas de projeto

Toda entrada `AD-NNN` de `.specs/STATE.md` com `Status: active` é uma **restrição** que esta task
precisa respeitar. Se uma decisão de feature anterior conflita com o que é melhor aqui, você tem
duas saídas — ambas exigem escolha explícita:

1. **Conformar** — desenhe dentro da restrição ativa.
2. **Superar** — pergunte ao usuário e, aprovado, acrescente um `AD-NNN` novo em `.specs/STATE.md`
   que substitui o antigo (marcando o antigo como `superseded by AD-NNN`) e documente o motivo. A
   decisão nova passa a ser o padrão do projeto.

**Ignorar uma decisão ativa em silêncio não é opção** — cria inconsistência invisível entre
features, que só aparece meses depois.

Quando a decisão merecer documento longo (comparação de alternativas, benchmark, plano de adoção),
a discovery tipo `adr`/`rfc` é o documento e a entrada `AD-NNN` é o índice que aponta para ela.

## Sinalizar riscos encontrados no caminho

Enquanto lê o código, anote o que encontrar de problemático **nas áreas que esta task toca**:

- código frágil — acoplamento forte, função gigante, estado implícito;
- dívida técnica — gambiarra, workaround, API deprecada;
- risco de segurança — input não validado, brecha de auth, segredo exposto;
- gargalo — N+1, loop sem limite, índice faltando;
- lacuna de teste — caminho não testado do qual esta task depende.

Cada achado vai para **Pontos que merecem atenção** no relatório, com `file:line` e o que você
sugere fazer. Não conserte nada: você não altera código de produção.
