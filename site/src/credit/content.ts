// Copy and prices for the Buy-API-Credit page (ott24x7.com/buy-api-credit). Edit prices here.

export const API_URL = 'https://api.ott24x7.com/v1';

/** "Buy" goes through the shop, which redirects to WhatsApp with the live support number. */
export const buyUrl = (plan: string) => `/ai/buy?plan=${encodeURIComponent(plan)}`;

export const API_NAV = [
  { href: '#models', label: 'Models' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#usage', label: 'Credit usage' },
  { href: '#developers', label: 'Developers' },
  { href: '#app', label: 'Free app' },
  { href: '#faq', label: 'FAQ' },
];

export const MODEL_GROUPS: { name: string; icon: string; tone: 'red' | 'blue'; models: string[] }[] = [
  { name: 'OpenAI', icon: '🧠', tone: 'blue', models: ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-5.6-sol'] },
  { name: 'Claude', icon: '🎭', tone: 'red', models: ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  { name: 'Google Gemini', icon: '🌐', tone: 'blue', models: ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3-flash'] },
  { name: 'xAI Grok', icon: '🚀', tone: 'red', models: ['grok-4.7', 'grok-4.6', 'composer-2.5'] },
  { name: 'Top Chinese LLMs', icon: '🐉', tone: 'blue', models: ['deepseek-v4-pro', 'kimi-k3.1-pro', 'qwen3.8-max', 'glm-5.3'] },
  { name: 'Image & Video', icon: '🎨', tone: 'red', models: ['gpt-image-2.6', 'grok-imagine-image', 'seedance-2.5', 'minimax-h3-1080p'] },
];

export const MODEL_COUNT = MODEL_GROUPS.reduce((n, g) => n + g.models.length, 0);

export type Plan = {
  id: string;
  name: string;
  inr: string;
  usd: string;
  credits: string;
  note?: string;
  badge?: string;
  /** Relative size for the value bar on the card. */
  value: number;
};

export const PAYG: Plan[] = [
  { id: 'payg-300', value: 40, name: 'Credits', inr: '₹300', usd: '$3.00', credits: '$40 credit', note: 'worth ₹4,000' },
  { id: 'payg-750', value: 100, name: 'Credits', inr: '₹750', usd: '$7.50', credits: '$100 credit', note: 'worth ₹10,000' },
  { id: 'payg-1500', value: 200, name: 'Credits', inr: '₹1,500', usd: '$15', credits: '$200 credit', note: 'worth ₹20,000', badge: 'Popular' },
  { id: 'payg-3000', value: 400, name: 'Credits', inr: '₹3,000', usd: '$30', credits: '$400 credit', note: 'worth ₹40,000' },
  { id: 'payg-7500', value: 1000, name: 'Credits', inr: '₹7,500', usd: '$75', credits: '$1,000 credit', note: 'worth ₹1,00,000' },
];

export const WEEK: Plan[] = [
  { id: 'week-starter', value: 50, name: 'Starter', inr: '₹375', usd: '$3.75', credits: '$50 credit', note: 'worth ₹5,000' },
  { id: 'week-developer', value: 100, name: 'Developer', inr: '₹675', usd: '$6.75', credits: '$100 credit', note: 'worth ₹10,000', badge: 'Popular' },
  { id: 'week-pro', value: 200, name: 'Pro', inr: '₹1,349', usd: '$13.49', credits: '$200 credit', note: 'worth ₹20,000' },
  { id: 'week-scale', value: 500, name: 'Scale', inr: '₹2,999', usd: '$29.99', credits: '$500 credit', note: 'worth ₹50,000' },
];

export const MONTH: Plan[] = [
  { id: 'month-essential', value: 360, name: 'Essential', inr: '₹1,500', usd: '$15', credits: '$12 credit daily', note: '$360 total · worth ₹36,000' },
  { id: 'month-plus', value: 900, name: 'Plus', inr: '₹3,600', usd: '$36', credits: '$30 credit daily', note: '$900 total · worth ₹90,000' },
  {
    id: 'month-cruise', value: 3000,
    name: 'Cruise',
    inr: '₹13,500',
    usd: '$135',
    credits: '$100 credit daily',
    note: '$3,000 total · worth ₹3,00,000',
    badge: 'Best value',
  },
  { id: 'month-business', value: 4500, name: 'Business', inr: '₹21,600', usd: '$216', credits: '$150 credit daily', note: '$4,500 total · worth ₹4,50,000' },
  { id: 'month-lightspeed', value: 9000, name: 'Lightspeed', inr: '₹43,200', usd: '$432', credits: '$300 credit daily', note: '$9,000 total · worth ₹9,00,000' },
];

export const PLAN_TABS = [
  {
    key: 'payg',
    label: 'Pay-as-you-go',
    plans: PAYG,
    per: 'one-time',
    points: ['Credits never expire', 'Custom amount: ₹150 ($1.50) = $20 credit (worth ₹2,000)'],
  },
  { key: 'week', label: '7-day passes', plans: WEEK, per: 'for 7 days', points: ['Valid for 7 days'] },
  {
    key: 'month',
    label: 'Monthly passes',
    plans: MONTH,
    per: 'per month',
    points: ['30 days, credits reset every day', 'One-time payment, no auto-renewal'],
  },
] as const;

export const ENDPOINTS = ['/v1/chat/completions', '/v1/messages', '/v1/images/generations', '/v1/videos'];

export const CODE: { key: string; label: string; code: string }[] = [
  {
    key: 'python',
    label: 'Python',
    code: `from openai import OpenAI

client = OpenAI(
    base_url="${API_URL}",
    api_key="YOUR_API_KEY",
)

reply = client.chat.completions.create(
    model="claude-sonnet-5-5",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(reply.choices[0].message.content)`,
  },
  {
    key: 'node',
    label: 'Node.js',
    code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${API_URL}",
  apiKey: "YOUR_API_KEY",
});

const reply = await client.chat.completions.create({
  model: "gpt-6.1-sol",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(reply.choices[0].message.content);`,
  },
  {
    key: 'curl',
    label: 'cURL',
    code: `curl ${API_URL}/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-3.8-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  },
  {
    key: 'anthropic',
    label: 'Anthropic SDK',
    code: `import anthropic

client = anthropic.Anthropic(
    base_url="${API_URL.replace(/\/v1$/, '')}",
    api_key="YOUR_API_KEY",
)

msg = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)
print(msg.content[0].text)`,
  },
];

export const API_FAQ: { q: string; a: string }[] = [
  {
    q: 'What does “$40 credit” mean?',
    a: 'Credit is API usage counted in US dollars. For ₹300 you get $40 of credit — that is ₹4,000 worth of usage (at $1 = ₹100). Every plan works the same way.',
  },
  {
    q: 'How do I get my API key?',
    a: 'Pick a plan and tap “Buy on WhatsApp”. Pay by UPI or bank transfer, and you get your key with the credits added.',
  },
  {
    q: 'Do credits expire?',
    a: 'Pay-as-you-go credits never expire. 7-day passes are valid for 7 days. Monthly passes last 30 days, and their credits reset every day.',
  },
  {
    q: 'Is there a monthly fee or auto-renewal?',
    a: 'No. Every plan is a one-time payment. Nothing renews on its own — top up again only when you want.',
  },
  {
    q: 'Which apps and SDKs work with it?',
    a: 'Anything that works with the OpenAI or Anthropic API: the official SDKs, VS Code extensions like Continue and Aider, and any OpenAI-compatible app. Set the base URL to https://api.ott24x7.com/v1 and paste your key.',
  },
  {
    q: 'Can I generate images and videos?',
    a: 'Yes. Use /v1/images/generations and /v1/videos with models like gpt-image-2.6, grok-imagine-image, seedance-2.5 and minimax-h3-1080p — or use the Image & Video Studio in the free app.',
  },
  {
    q: 'How do I pay?',
    a: 'UPI or bank transfer. Message us on WhatsApp with the plan you want.',
  },
];

export const USE_CASES: { icon: string; title: string; text: string; art: 'code' | 'test' | 'text' | 'image' | 'video' }[] = [
  { icon: '💻', title: 'Coding', text: 'Write, fix and explain code with the strongest coding models.', art: 'code' },
  { icon: '🧪', title: 'App testing', text: 'Generate test cases and check your app’s answers at scale.', art: 'test' },
  { icon: '✍️', title: 'Content', text: 'Blogs, captions, emails and scripts in any language.', art: 'text' },
  { icon: '🖼️', title: 'Images', text: 'Create images with gpt-image-2.6 and grok-imagine-image.', art: 'image' },
  { icon: '🎬', title: 'Videos', text: 'Make 1080p videos with seedance-2.5 and minimax-h3-1080p.', art: 'video' },
];

export const STEPS = [
  { title: 'Pick a plan', text: 'Pay-as-you-go credits, a 7-day pass or a monthly pass.' },
  { title: 'Pay on WhatsApp', text: 'Tap “Buy on WhatsApp” and pay by UPI or bank transfer.' },
  { title: 'Paste your key', text: 'Use it in the free OTT24x7 AI app, your code, or any OpenAI-compatible tool.' },
];

export const APP_POINTS = [
  'Windows desktop app + Android app',
  'Compare multiple AIs side by side',
  'AI Image Studio + AI Video Generator',
  'Paste your key and start — no setup needed',
];
