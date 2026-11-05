import { DEFAULT_ASSISTANT_SETTINGS } from '@shared/data/types/assistant'

export const DEFAULT_ASSISTANT_NAME = 'OTT24x7 AI Assistant' as const
export const DEFAULT_ASSISTANT_EMOJI = '😀' as const
export const DEFAULT_ASSISTANT_PROMPT = '' as const

export function getDefaultAssistantNameForLocale(_locale?: string | null): string {
  void _locale
  return DEFAULT_ASSISTANT_NAME
}

export const DEFAULT_ASSISTANT_SEED = {
  name: DEFAULT_ASSISTANT_NAME,
  emoji: DEFAULT_ASSISTANT_EMOJI,
  prompt: DEFAULT_ASSISTANT_PROMPT,
  description: '',
  modelId: null,
  settings: DEFAULT_ASSISTANT_SETTINGS
} as const
