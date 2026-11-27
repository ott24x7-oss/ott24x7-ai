// Credit charged per model. Text models: dollars of credit per 1M tokens.
// Image models: per image. Video models: per second of video.
// Edit here when rates change.

export type TextRate = { model: string; tag?: string; input: number; cached: number; output: number };
export type MediaRate = { model: string; price: number; unit: 'image' | 'second'; note?: string };

export const TEXT_RATES: { family: string; icon: string; rates: TextRate[] }[] = [
  {
    family: 'OpenAI',
    icon: '🧠',
    rates: [
      { model: 'gpt-6-astra', tag: 'Flagship', input: 10, cached: 1, output: 50 },
      { model: 'gpt-6.1-sol', tag: 'Balanced', input: 2, cached: 0.1, output: 10 },
      { model: 'gpt-6.1-terra', tag: 'Balanced', input: 1, cached: 0.05, output: 5 },
      { model: 'gpt-6-sol', tag: 'Balanced', input: 2, cached: 0.2, output: 10 },
      { model: 'gpt-5.6-sol', tag: 'Flagship', input: 5, cached: 0.5, output: 30 },
      { model: 'gpt-5.6-terra', tag: 'Balanced', input: 2, cached: 0.2, output: 12 },
    ],
  },
  {
    family: 'Claude',
    icon: '🎭',
    rates: [
      { model: 'claude-fable-5-1', tag: 'Flagship', input: 10, cached: 0.25, output: 50 },
      { model: 'claude-fable-5', tag: 'Flagship', input: 10, cached: 1, output: 50 },
      { model: 'claude-opus-5-5', tag: 'Flagship', input: 4, cached: 0.2, output: 20 },
      { model: 'claude-opus-5', tag: 'Flagship', input: 5, cached: 0.5, output: 25 },
      { model: 'claude-sonnet-5-5', tag: 'Balanced', input: 2, cached: 0.2, output: 10 },
      { model: 'claude-sonnet-5', tag: 'Balanced', input: 2, cached: 0.2, output: 10 },
      { model: 'claude-haiku-5-5', tag: 'Fast', input: 0.1, cached: 0.01, output: 0.5 },
      { model: 'claude-opus-4-8', tag: 'Flagship', input: 5, cached: 0.5, output: 25 },
      { model: 'claude-opus-4-7', tag: 'Flagship', input: 5, cached: 0.5, output: 25 },
      { model: 'claude-opus-4-6', tag: 'Flagship', input: 5, cached: 0.5, output: 25 },
      { model: 'claude-sonnet-4-6', tag: 'Balanced', input: 3, cached: 0.3, output: 15 },
      { model: 'claude-sonnet-4-5', input: 3, cached: 0.3, output: 15 },
      { model: 'claude-haiku-4-5-20251001', tag: 'Fast', input: 1, cached: 0.1, output: 5 },
    ],
  },
  {
    family: 'Google Gemini',
    icon: '🌐',
    rates: [
      { model: 'gemini-4-argon', tag: 'Flagship', input: 2, cached: 0.1, output: 10 },
      { model: 'gemini-3.8-flash', tag: 'Balanced', input: 0.75, cached: 0.075, output: 3.75 },
      { model: 'gemini-3.7-flash', tag: 'Balanced', input: 0.75, cached: 0.075, output: 3.75 },
      { model: 'gemini-3.6-flash', tag: 'Balanced', input: 0.75, cached: 0.075, output: 3.75 },
      { model: 'gemini-3-flash', tag: 'Fast', input: 0.5, cached: 0.05, output: 3 },
      { model: 'gemini-3.1-flash-lite', tag: 'Fast', input: 0.25, cached: 0.025, output: 1.5 },
    ],
  },
  {
    family: 'xAI Grok',
    icon: '🚀',
    rates: [
      { model: 'grok-4.7', tag: 'Flagship', input: 2, cached: 0.5, output: 6 },
      { model: 'grok-4.6', tag: 'Flagship', input: 2, cached: 0.5, output: 6 },
      { model: 'grok-4.5', tag: 'Flagship', input: 2, cached: 0.3, output: 6 },
      { model: 'grok', tag: 'Flagship', input: 2, cached: 0.3, output: 6 },
      { model: 'composer-2.5', tag: 'Code', input: 2, cached: 0.3, output: 6 },
      { model: 'grok-composer-2.5-fast', tag: 'Code', input: 2, cached: 0.3, output: 6 },
      { model: 'grok-composer', tag: 'Code', input: 2, cached: 0.3, output: 6 },
      { model: 'grok-build-latest', tag: 'Code', input: 1, cached: 0.2, output: 2 },
    ],
  },
  {
    family: 'Chinese LLMs',
    icon: '🐉',
    rates: [
      { model: 'deepseek-v4-pro', tag: 'Reasoning', input: 1.35, cached: 0.045, output: 4.04 },
      { model: 'deepseek-v4-pro-0813', tag: 'Reasoning', input: 1.35, cached: 0.045, output: 4.04 },
      { model: 'deepseek-v4.1-flash', tag: 'Fast', input: 0.3, cached: 0.006, output: 1.2 },
      { model: 'deepseek-v4-flash-0731', tag: 'Fast', input: 0.3, cached: 0.006, output: 1.2 },
      { model: 'deepseek-flash', tag: 'Fast', input: 0.3, cached: 0.006, output: 1.2 },
      { model: 'kimi-k3.1-pro', tag: 'Flagship', input: 1.94, cached: 0.19, output: 10.17 },
      { model: 'kimi-k3', tag: 'Flagship', input: 2.99, cached: 0.3, output: 14.96 },
      { model: 'kimi-k2.7-code', tag: 'Code', input: 0.97, cached: 0.19, output: 4.04 },
      { model: 'kimi-k2.5', tag: 'Code', input: 0.6, cached: 0.1, output: 3.14 },
      { model: 'qwen3.8-max', tag: 'Flagship', input: 1.79, cached: 0.22, output: 5.38 },
      { model: 'qwen3.7-max', tag: 'Flagship', input: 1.79, cached: 0.36, output: 5.38 },
      { model: 'glm-5.3', tag: 'Flagship', input: 1.2, cached: 0.3, output: 4.19 },
      { model: 'glm-5.3-flashx', tag: 'Fast', input: 0.3, cached: 0.085, output: 1.05 },
      { model: 'glm-5.3-flash', tag: 'Fast', input: 0.12, cached: 0.034, output: 0.42 },
      { model: 'glm-5.2', tag: 'Flagship', input: 1.2, cached: 0.3, output: 4.19 },
      { model: 'glm-5.1', tag: 'Flagship', input: 0.9, cached: 0.19, output: 3.59 },
      { model: 'minimax-m3', tag: 'Long context', input: 0.31, cached: 0.063, output: 1.26 },
      { model: 'minimax-m2.7', tag: 'Code', input: 0.31, cached: 0.063, output: 1.26 },
      { model: 'hy4-preview', tag: 'Flagship', input: 0.9, cached: 0.045, output: 2.69 },
      { model: 'hy3', tag: 'Balanced', input: 0.15, cached: 0.037, output: 0.6 },
    ],
  },
];

export const IMAGE_RATES: MediaRate[] = [
  { model: 'gpt-image-2.6', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2.6-4k', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2.6-flare', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2.6-sunburst', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2.5', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2.5-flare', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2.5-sunburst', price: 0.2, unit: 'image' },
  { model: 'gpt-image-2', price: 0.2, unit: 'image' },
  { model: 'grok-imagine-image', price: 0.2, unit: 'image' },
  { model: 'gemini-3.1-flash-image', price: 0.45, unit: 'image' },
  { model: 'gemini-3-pro-image', price: 0.6, unit: 'image' },
];

export const VIDEO_RATES: MediaRate[] = [
  { model: 'grok-video', price: 0.2, unit: 'second', note: '6 / 10 / 15 s clips' },
  { model: 'grok-imagine-video', price: 1.0, unit: 'second', note: '480p' },
  { model: 'grok-imagine-video', price: 1.4, unit: 'second', note: '720p' },
  { model: 'grok-imagine-video-1.5', price: 1.5, unit: 'second', note: '480p' },
  { model: 'grok-imagine-video-1.5', price: 2.63, unit: 'second', note: '720p' },
  { model: 'grok-imagine-video-1.5', price: 4.69, unit: 'second', note: '1080p' },
  { model: 'minimax-h3-original-768p', price: 0.7, unit: 'second', note: '768p, 4–15 s' },
  { model: 'minimax-h3-original-1080p', price: 1.05, unit: 'second', note: '1080p, 4–15 s' },
  { model: 'minimax-h3-original-cf-2k', price: 1.05, unit: 'second', note: '2K, 4–15 s' },
  { model: 'seedance-2.5', price: 7.65, unit: 'second', note: '720p' },
  { model: 'seedance-2.5', price: 19.89, unit: 'second', note: '1080p' },
];

/** A typical chat message used by the calculator: ~1,000 tokens in, ~500 out. */
export const TYPICAL = { input: 1000, output: 500 };

export const money = (n: number) => {
  if (n >= 1) return `$${n.toFixed(2).replace(/\.00$/, '')}`;
  if (n >= 0.1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4).replace(/0+$/, '')}`;
};

export const compact = (n: number) => {
  if (n >= 1e7) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.floor(n)}`;
};
