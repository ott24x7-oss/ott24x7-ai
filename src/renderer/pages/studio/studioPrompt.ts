import { ipcApi } from '@renderer/ipc'
import type { UniqueModelId } from '@shared/data/types/model'

export async function improveStudioPrompt(
  uniqueModelId: UniqueModelId,
  prompt: string,
  options: { style?: string; camera?: string; lighting?: string; aspectRatio?: string } = {}
): Promise<string> {
  const { text } = await ipcApi.request('ai.text.generate', {
    uniqueModelId,
    reasoningEffort: 'none',
    system: [
      'Rewrite the user prompt as a detailed image or video generation prompt.',
      `Style: ${options.style || 'choose a fitting style'}.`,
      `Camera: ${options.camera || 'choose an appropriate camera framing'}.`,
      `Lighting: ${options.lighting || 'choose suitable lighting'}.`,
      `Aspect ratio: ${options.aspectRatio || 'choose a fitting aspect ratio'}.`,
      'Keep the subject and intent. Return only the finished prompt.'
    ].join('\n'),
    prompt: prompt.trim()
  })
  return text.trim()
}
