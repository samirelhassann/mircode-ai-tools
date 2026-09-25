#!/usr/bin/env bash
# specs-usage-statusline.sh — captura o uso do plano a partir do statusLine do Claude Code.
#
# POR QUE ISSO EXISTE
#
# O medidor "Uso do plano" da Specs Platform lia o histórico que o **app desktop**
# do Claude grava (`~/Library/Application Support/Claude/plan-usage-history.json`).
# Esse arquivo só é escrito enquanto o app está aberto — quem trabalha só no
# terminal fica com um número congelado de dias atrás.
#
# Não existe endpoint da API para consultar isso: a Usage & Cost Admin API exige
# chave de organização do Console e reporta tokens/custo da API, não a janela de
# 5h/7d do plano. Mas o **Claude Code** recebe o dado a cada resposta e o entrega
# no JSON do statusLine, em `rate_limits.five_hour` e `rate_limits.seven_day`
# (só para assinantes Pro/Max, e só depois da primeira resposta da sessão).
#
# Este script fica no meio desse caminho: lê o JSON, grava o pedaço de rate limit
# em ~/.claude/specs-usage.json — que a plataforma observa — e repassa o MESMO
# JSON para o seu statusLine original, cuja saída ele ecoa sem alterar.
#
# USO
#
# Em ~/.claude/settings.json:
#
#   "statusLine": {
#     "type": "command",
#     "command": "bash ~/mircode/specs-platform/scripts/specs-usage-statusline.sh ~/.claude/statusline-command.sh"
#   }
#
# Sem statusLine próprio, chame sem argumento: o script só grava o snapshot e
# imprime uma linha curta com os dois percentuais.
#
# Requer `jq`.

set -euo pipefail

SNAPSHOT="${SPECS_USAGE_SNAPSHOT:-$HOME/.claude/specs-usage.json}"

input=$(cat)

# --- 1) Grava o snapshot, se o JSON trouxer rate_limits -------------------
# `// empty` faz o jq não imprimir nada quando o campo está ausente — que é o
# caso de contas API-key, ou antes da primeira resposta da sessão. Sem dado,
# não mexemos no arquivo: um snapshot antigo e honesto vale mais que um vazio.
if command -v jq >/dev/null 2>&1; then
  snapshot=$(printf '%s' "$input" | jq -c \
    '(.rate_limits // empty)
     | select((.five_hour // .seven_day) != null)
     | { measuredAt: (now * 1000 | floor),
         five_hour:  (.five_hour  // null),
         seven_day:  (.seven_day  // null) }' 2>/dev/null || true)

  if [[ -n "${snapshot:-}" ]]; then
    mkdir -p "$(dirname "$SNAPSHOT")"
    # Escrita atômica: a plataforma observa este arquivo e não pode ler um JSON
    # pela metade.
    tmp="${SNAPSHOT}.tmp.$$"
    printf '%s\n' "$snapshot" > "$tmp" && mv -f "$tmp" "$SNAPSHOT"
  fi
fi

# --- 2) Repassa para o statusLine original --------------------------------
if [[ $# -gt 0 ]]; then
  printf '%s' "$input" | "$@"
  exit $?
fi

# Sem comando encadeado: uma linha mínima, para o statusLine não ficar vazio.
if command -v jq >/dev/null 2>&1; then
  printf '%s' "$input" | jq -r '
    [ (.model.display_name // "Claude"),
      (if .rate_limits.five_hour.used_percentage != null
       then "5h \(.rate_limits.five_hour.used_percentage | floor)%" else empty end),
      (if .rate_limits.seven_day.used_percentage != null
       then "7d \(.rate_limits.seven_day.used_percentage | floor)%" else empty end)
    ] | join(" · ")'
fi
