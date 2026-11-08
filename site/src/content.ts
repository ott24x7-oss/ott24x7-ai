// All page copy and links live here so they are easy to edit.

export const LINKS = {
  repo: 'https://github.com/ott24x7-oss/ott24x7-ai',
  releases: 'https://github.com/ott24x7-oss/ott24x7-ai/releases',
  license: 'https://github.com/ott24x7-oss/ott24x7-ai/blob/main/LICENSE',
  windows: 'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/OTT24x7-AI-Setup.exe',
  android: 'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/OTT24x7-AI.apk',
  contact: 'https://ott24x7.com/contact',
  shop: 'https://ott24x7.com',
  keys: 'https://keys24x7.com',
};

/** Screenshot ids match file names in screenshots/<kind>/<name>.png */
export type ShotId =
  | 'desktop/01-compare-4-ai-answers'
  | 'desktop/02-final-answer'
  | 'desktop/03-live-answers'
  | 'desktop/04-web-search-exa'
  | 'desktop/05-model-provider'
  | 'desktop/06-web-panels'
  | 'desktop/07-history-light'
  | 'desktop/08-default-model'
  | 'desktop/09-local-models'
  | 'desktop/10-skills'
  | 'desktop/11-usage'
  | 'desktop/12-dependencies'
  | 'desktop/13-channels'
  | 'android/answers-dark'
  | 'android/model-picker'
  | 'android/final-answer'
  | 'android/settings';

/**
 * Desktop files are matched by their number prefix (01…07), so the exact
 * name after the number does not matter. See shots.ts.
 */
export const ALT: Record<ShotId, string> = {
  'desktop/01-compare-4-ai-answers':
    'OTT24x7 AI on Windows showing four AI answers side by side, each column marked Sent',
  'desktop/02-final-answer':
    'The Final answer panel on the right, combining every answer, with the Judge model picker at the top',
  'desktop/03-live-answers':
    'Claude, ChatGPT, Gemini and DeepSeek side by side, each answering “what’s the weather today in India?” with live data',
  'desktop/04-web-search-exa': 'Web Search settings with Exa chosen as the search service provider',
  'desktop/05-model-provider':
    'Settings → Model Provider: sign-in providers, API key providers and the "Add custom API (key + URL)" button',
  'desktop/06-web-panels':
    'The "My subscriptions" set with ChatGPT, Claude, Gemini and DeepSeek web panels, ready to sign in',
  'desktop/07-history-light':
    'The History page in light mode, with conversation search, an assistant filter and the Dark / Light switch',
  'desktop/08-default-model': 'Default Model settings: assistant, quick, translate and painting models',
  'desktop/09-local-models': 'Local Models that run offline on your PC, with hardware acceleration',
  'desktop/10-skills': 'Skills settings with built-in skills that can be turned on or off',
  'desktop/11-usage': 'Usage overview with tokens, requests and cost over the last 30 days',
  'desktop/12-dependencies': 'Dependencies settings listing bundled tools like uv, Bun and ripgrep',
  'desktop/13-channels': 'Channels settings for replying through Telegram, Discord, Slack and more',
  'android/answers-dark':
    'OTT24x7 AI on Android: a question at the top and a swipeable ChatGPT answer card, 1 of 4',
  'android/model-picker': 'The Android model sheet for picking which AIs to ask',
  'android/final-answer': 'The Android Final answer sheet, combined from the selected models',
  'android/settings': 'Android settings for theme, web panels and custom API endpoints',
};

export const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#guide', label: 'User guide' },
  { href: '#download', label: 'Download' },
  { href: '#faq', label: 'FAQ' },
];

export const FEATURES: { icon: string; title: string; text: string; shot?: ShotId; fallback?: ShotId; pos?: string; code?: string[] }[] = [
  {
    icon: 'columns',
    title: 'Compare up to 8 AIs',
    text: 'Send one prompt and read every answer side by side.',
    shot: 'desktop/01-compare-4-ai-answers',
  },
  {
    icon: 'sparkles',
    title: '✦ One Final answer',
    text: 'Combine them into the best answer — see where they agree and where they differ.',
    shot: 'desktop/02-final-answer',
    fallback: 'android/final-answer',
    pos: 'right top',
  },
  {
    icon: 'globe',
    title: 'Live answers',
    text: 'Ask about today’s weather, news or prices. Turn on 🌐 Web search for sources, powered by Exa.',
    shot: 'desktop/03-live-answers',
  },
  {
    icon: 'panels',
    title: 'Web panels',
    text: 'Sign in once to ChatGPT, Claude, Gemini and DeepSeek inside the app.',
    shot: 'desktop/06-web-panels',
  },
  {
    icon: 'plug',
    title: 'Your own API models',
    text: 'Add OpenRouter or any OpenAI-compatible URL with your key.',
    shot: 'desktop/05-model-provider',
    pos: 'left bottom',
  },
  {
    icon: 'phone',
    title: 'Android app',
    text: 'Swipe through answer cards on your phone.',
    shot: 'android/answers-dark',
  },
];

export const HOW: { title: string; text: string; shot: ShotId; fallback?: ShotId }[] = [
  {
    title: 'Pick your AIs',
    text: 'Choose a set like "My subscriptions", or mix web panels and API models.',
    shot: 'desktop/06-web-panels',
    fallback: 'android/model-picker',
  },
  {
    title: 'Ask once',
    text: 'Type one question. Every AI gets it at the same time.',
    shot: 'desktop/01-compare-4-ai-answers',
    fallback: 'android/answers-dark',
  },
  {
    title: 'Combine into one answer',
    text: 'Click ✦ Combine. A judge model writes one best answer from all of them.',
    shot: 'desktop/02-final-answer',
    fallback: 'android/final-answer',
  },
];

export type Step = { title: string; text: string; shots: ShotId[] };

export const GUIDE_DESKTOP: Step[] = [
  {
    title: 'Install the app',
    text: 'Download OTT24x7-AI-Setup.exe and run it. If Windows shows SmartScreen, click "More info" → "Run anyway".',
    shots: [],
  },
  {
    title: 'Open Compare',
    text: 'The default set "My subscriptions" has ChatGPT, Claude, Gemini and DeepSeek.',
    shots: ['desktop/06-web-panels'],
  },
  {
    title: 'Sign in once',
    text: 'Sign in inside each web panel with your own account. Email login works best. The app remembers it.',
    shots: [],
  },
  {
    title: 'Add API models (optional)',
    text: 'Go to Settings → Model Provider → "Add custom API (key + URL)".',
    shots: ['desktop/05-model-provider'],
  },
  {
    title: 'Ask all models',
    text: 'Type your question in "Ask all models…" and press Enter. Every column shows "Sent ✓".',
    shots: ['desktop/01-compare-4-ai-answers'],
  },
  {
    title: 'Choose the layout',
    text: 'Use the 1 / 2 / 3 / 4 buttons to choose how many columns show at once. Focus opens one at full width.',
    shots: [],
  },
  {
    title: 'Combine the answers',
    text: 'Click "✦ Combine". The Final answer panel opens on the right. Pick the Judge model at the top.',
    shots: ['desktop/02-final-answer'],
  },
  {
    title: 'Turn on web search',
    text: 'Switch on 🌐 Web search for fresh news and prices. Answers come with sources.',
    shots: ['desktop/04-web-search-exa', 'desktop/03-live-answers'],
  },
  {
    title: 'History and themes',
    text: 'History keeps every comparison. "New chat" starts fresh. Switch Dark / Light at the bottom-left.',
    shots: ['desktop/07-history-light'],
  },
];

export const GUIDE_ANDROID: Step[] = [
  {
    title: 'Install the APK',
    text: 'Download the APK on your phone. Allow "Install unknown apps" for your browser, then install.',
    shots: [],
  },
  { title: 'Pick your AIs', text: 'Choose models from the model sheet.', shots: ['android/model-picker'] },
  { title: 'Ask once', text: 'Ask your question, then swipe through the answer cards.', shots: ['android/answers-dark'] },
  { title: 'Combine', text: 'Tap "✦ Combine" to open the Final answer sheet.', shots: ['android/final-answer'] },
  { title: 'Settings', text: 'Change the theme, web panels and custom endpoints.', shots: ['android/settings'] },
];

export const GALLERY: Record<'desktop' | 'android', ShotId[]> = {
  desktop: [
    'desktop/01-compare-4-ai-answers',
    'desktop/02-final-answer',
    'desktop/03-live-answers',
    'desktop/04-web-search-exa',
    'desktop/05-model-provider',
    'desktop/06-web-panels',
    'desktop/07-history-light',
    'desktop/08-default-model',
    'desktop/09-local-models',
    'desktop/10-skills',
    'desktop/11-usage',
    'desktop/12-dependencies',
    'desktop/13-channels',
  ],
  android: ['android/answers-dark', 'android/model-picker', 'android/final-answer', 'android/settings'],
};

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is it free?',
    a: 'Yes. OTT24x7 AI is free and open source under the AGPL-3.0 license. There is no sign-up and no paid plan.',
  },
  {
    q: 'Do I need API keys?',
    a: 'No. ChatGPT, Claude, Gemini and DeepSeek run as web panels — you sign in with your own account, the same as in a browser. API keys are only needed if you want to add extra API models, such as OpenRouter.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. There are no accounts and no telemetry. Your chats, settings and logins stay on your device. Each web panel talks directly to that AI’s own website.',
  },
  {
    q: 'Which AIs are supported?',
    a: 'ChatGPT, Claude, Gemini and DeepSeek as web panels (Grok, Copilot and Perplexity are there too on Windows), plus any model from OpenRouter or any OpenAI-compatible API URL.',
  },
  {
    q: 'Why does Google sign-in not work in the app?',
    a: 'Google blocks sign-in inside apps for security. Use email login for that AI instead, or choose "Open in Chrome tab".',
  },
  {
    q: 'How do I update?',
    a: 'Download the latest version from this page or GitHub Releases and install it over the old one. Your chats and logins are kept.',
  },
  {
    q: 'Does it work on Mac?',
    a: 'Not yet. Right now it runs on Windows 10/11 (64-bit) and Android 8 or newer.',
  },
];
