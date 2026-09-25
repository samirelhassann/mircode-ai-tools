/**
 * Sinal de expandir/recolher em massa. A revisão abre com tudo fechado — o
 * `nonce` muda a cada clique no botão para reabrir/refechar mesmo quando o
 * usuário já mexeu em cards individuais no meio do caminho.
 */
export type BulkToggle = { open: boolean; nonce: number }
