export interface CompareCliTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Keep a small stateless transcript so each CLI process can answer follow-up prompts. */
export function buildCompareCliPrompt(history: readonly CompareCliTurn[], currentPrompt: string): string {
  const recent = history.slice(-20)
  const transcript = recent
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}:\n${turn.content}`)
    .join('\n\n')
  return [
    'Answer the current user message as a single, read-only response. Do not use tools or modify files.',
    transcript ? `Previous turns:\n${transcript}` : '',
    `Current user message:\n${currentPrompt}`
  ]
    .filter(Boolean)
    .join('\n\n')
}
