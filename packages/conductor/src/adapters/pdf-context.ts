export function extractPdfSelection(contextText: string): string | null {
  const match = contextText.match(/<pdf-selection>([\s\S]*?)<\/pdf-selection>/i);
  if (!match) {
    return null;
  }

  const raw = match[1]
    .replace(/<truncated-content\s*\/>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return raw.length > 0 ? raw : null;
}

interface ModelContextLike {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

export function extractSelectionFromModelContext(context: ModelContextLike | null | undefined): string | null {
  if (!context?.content?.length) {
    return null;
  }

  const text = context.content
    .filter((entry) => entry.type === 'text' && typeof entry.text === 'string')
    .map((entry) => entry.text ?? '')
    .join('\n');

  if (!text) {
    return null;
  }

  return extractPdfSelection(text);
}
