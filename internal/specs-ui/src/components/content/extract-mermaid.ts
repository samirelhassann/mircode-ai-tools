/**
 * Extrai os blocos ```mermaid de um markdown. Um desenho é o diagrama, não o
 * texto em volta: a página renderiza estes blocos num canvas com zoom, e o resto
 * do arquivo (se houver) fica só no editor.
 */
export function extractMermaidBlocks(body: string): string[] {
  const blocks: string[] = []
  const re = /^[ \t]*```+[ \t]*mermaid[^\n]*\n([\s\S]*?)^[ \t]*```+[ \t]*$/gm
  let match = re.exec(body)
  while (match !== null) {
    const source = match[1]?.trim()
    if (source) blocks.push(source)
    match = re.exec(body)
  }
  return blocks
}
