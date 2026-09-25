# Confrontar a spec com o código atual

Antes de tocar código: o escopo ainda faz sentido? há decisão em aberto? há melhoria óbvia que vale
propor?

O refinamento foi escrito **antes** e pode ter envelhecido. **Não o siga cegamente.**

## Divergências que exigem parada

- decisão que contradiz código já mergeado (ex.: manda criar `UserRoleDialog`, mas já existe
  `EditUserModal` mais completo);
- decisão que contradiz o protótipo atual;
- biblioteca ou primitivo que não cabe mais (deprecated, ou o projeto padronizou outro);
- estrutura de rotas/arquivos que viola convenção recente;
- critério que referencia algo inexistente — salvo se a task for justamente criar esse algo;
- padrão obsoleto (ex.: `unstable_cache` onde a versão atual usa `cacheTag`);
- abordagem que a doc atual (context7) desencoraja;
- critério que conflita com uma decisão `active` de `.specs/STATE.md`.

Para cada uma, `AskUserQuestion` com três coisas:

1. **o que a spec diz** — citando o trecho;
2. **o que existe hoje** — com evidência (`file:line`);
3. **2–3 opções** — seguir assim mesmo, adaptar, refinar antes de executar — **mais a sua
   recomendação**.

Divergência pequena e previsível (um import que mudou de lugar) você ajusta sozinho e sinaliza no
relatório de halt.

## Lacunas de precisão no critério

Critério de aceite sem desfecho preciso ("trata o erro graciosamente", "exibe mensagem amigável")
não dá para testar — a asserção vira vaga e passa com implementação errada.

Encontrou? **não invente o valor.** Pergunte qual é o desfecho esperado (status, campo, mensagem,
estado persistido) e registre a resposta como decisão no relatório. Se o usuário disser "você
decide", registre como **premissa** com o default escolhido e o racional, no formato da skill
`requirements-closure`.
