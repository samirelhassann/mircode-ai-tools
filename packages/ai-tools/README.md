# @mir-code/ai-tools

CLI `mircode-ai` — um ponto de entrada para instalar e operar as ferramentas de IA da mircode.

```bash
npm i -g @mir-code/ai-tools
```

## Menu interativo

```bash
mircode-ai
```

Escolha a ferramenta e a ação (ex.: **Specs Platform → Instalar / atualizar no projeto**). Ao final, o CLI mostra o comando equivalente para usar direto da próxima vez.

## Linha de comando

```bash
mircode-ai list                                  # ferramentas disponíveis
mircode-ai install specs-platform [dir] [--force] # atalho de instalação
mircode-ai specs-platform <comando>              # qualquer comando da ferramenta
mircode-ai specs-platform start
mircode-ai specs-platform --help
```

## Ferramentas

| Id | Pacote | Bin próprio |
|---|---|---|
| `specs-platform` | [`@mir-code/specs-platform`](../specs-platform/README.md) | `specs` |

Cada ferramenta também é publicada sozinha: quem só precisa de uma instala só o pacote dela.
