import { useMemo } from 'react'
import type { DrawingContentResponse } from '@/lib/types'
import { DrawingCanvas } from './drawing-canvas'
import { extractMermaidBlocks } from './extract-mermaid'

type Props = { content: DrawingContentResponse }

export function DrawingBodyContent({ content }: Props) {
  const sources = useMemo(() => extractMermaidBlocks(content.body), [content.body])
  return <DrawingCanvas sources={sources} />
}
