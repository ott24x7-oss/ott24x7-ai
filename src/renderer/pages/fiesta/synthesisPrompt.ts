export interface SynthesisAnswer {
  modelName: string
  content: string
}

const MAX_ANSWER_CHARACTERS = 8_000
const MAX_QUESTION_CHARACTERS = 8_000

export function buildSynthesisPrompt(question: string, answers: readonly SynthesisAnswer[]): string {
  const labelledQuestion = truncateQuestion(question)
  const labelledAnswers = answers
    .map(({ modelName, content }) => `## ${modelName}\n${truncateAnswer(content)}`)
    .join('\n\n')

  return [
    'You are judging several answers to the same user question. Use the answers as evidence, correct mistakes, and do not invent unsupported details.',
    '',
    '## User question',
    labelledQuestion,
    '',
    '## Model answers',
    labelledAnswers,
    '',
    'Return Markdown with these sections:',
    '## Best answer',
    'Give the merged, corrected, complete answer.',
    '',
    '## Where they agree',
    'List the main points the answers share.',
    '',
    '## Where they differ',
    'For each meaningful difference, say which answer is more likely right and why. If the evidence is insufficient, say so.',
    '',
    '## Scores',
    'Optionally include a table scoring each model from 1 to 10 with a one-line reason.'
  ].join('\n')
}

function truncateQuestion(question: string): string {
  if (question.length <= MAX_QUESTION_CHARACTERS) return question
  return `${question.slice(0, MAX_QUESTION_CHARACTERS)}\n\n[Question truncated after ${MAX_QUESTION_CHARACTERS.toLocaleString('en-US')} characters; original length: ${question.length.toLocaleString('en-US')} characters.]`
}

function truncateAnswer(content: string): string {
  if (content.length <= MAX_ANSWER_CHARACTERS) return content

  return `${content.slice(0, MAX_ANSWER_CHARACTERS)}\n\n[Answer truncated after ${MAX_ANSWER_CHARACTERS.toLocaleString('en-US')} characters; original length: ${content.length.toLocaleString('en-US')} characters.]`
}
