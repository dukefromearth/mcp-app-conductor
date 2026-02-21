
// Ideally, adapters do not exist. 
// Ultimiately, we put AI agents in direct contact with "What is possible?" and "What is the current state".
// Agents should be able to "bridge" gaps, if they're possible, and create reuseable adapters, after asking the user.
// For example:
//   User: "I need to read the text of this pdf outloud"
//   Agent: 
//     - [THOUGHT] "I need to fetch the current state of the entire system"
//     - [ACTION] "Fetch the current state of the system"
//     - [THOUGHT] "The conductor shows that the user sees a pdf app, and I have access to an app that can read text."
//     - [THOUGHT] "I can load that app, let me do it"
//     - [ACTION] "Load the say app"
//     - [THOUGHT] "I should confirm it's loaded correctly"
//     - [ACTION] "Confirm app load"
//     - [THOUGHT] "I "
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
