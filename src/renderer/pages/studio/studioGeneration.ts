export const STUDIO_GENERATION_STATUS_KEYS = [
  'studio.generation.creating',
  'studio.generation.details',
  'studio.generation.refining',
  'studio.generation.almost_there'
] as const

export function getStudioGenerationStatusIndex(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / 4000) % STUDIO_GENERATION_STATUS_KEYS.length
}

export function getStudioRevealMotion(index: number, reduceMotion: boolean) {
  if (reduceMotion) {
    return { initial: false as const, transition: { duration: 0 } }
  }

  return {
    initial: { filter: 'blur(16px)', opacity: 0.3, scale: 1.025 },
    transition: { delay: index * 0.12, duration: 0.7, ease: 'easeOut' as const }
  }
}

export const STUDIO_TEMPLATE_PROMPT_KEYS: Record<string, string> = {
  poster: 'studio.template_prompts.poster',
  logo: 'studio.template_prompts.logo',
  product: 'studio.template_prompts.product',
  thumbnail: 'studio.template_prompts.thumbnail',
  anime: 'studio.template_prompts.anime',
  render: 'studio.template_prompts.render',
  wallpaper: 'studio.template_prompts.wallpaper',
  sticker: 'studio.template_prompts.sticker'
}

export function getStudioTemplatePrompt(template: string, translate: (key: string) => string): string {
  const key = STUDIO_TEMPLATE_PROMPT_KEYS[template]
  return key ? translate(key) : ''
}
