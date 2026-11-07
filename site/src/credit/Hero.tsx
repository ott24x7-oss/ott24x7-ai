import { useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { API_URL, MODEL_COUNT, MODEL_GROUPS } from './content';

export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => undefined,
        );
      }}
      aria-label={done ? 'Copied' : `${label}: ${text}`}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${className}`}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? 'Copied' : label}
    </button>
  );
}

/** "One key → every model family" diagram with flowing lines. */
function KeyHub() {
  const groups = MODEL_GROUPS;
  // Positions (in %) around the key for the six families.
  const pos = [
    [12, 16],
    [88, 16],
    [4, 52],
    [96, 52],
    [16, 88],
    [84, 88],
  ];
  return (
    <>
    {/* Phone: key card + a simple grid of model families */}
    <div className="mx-auto mt-12 max-w-sm sm:hidden" aria-hidden="true">
      <div className="rounded-2xl bg-grad p-[2px] shadow-[0_30px_70px_-30px_#ff4d8d]">
        <div className="rounded-[14px] bg-[var(--code-bg)] px-4 py-4 text-left">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">your key</span>
          <p className="mt-2 truncate font-mono text-sm text-white/90">YOUR_API_KEY ••••••••</p>
          <p className="mt-1 truncate font-mono text-xs text-[#ffb27a]">{API_URL}</p>
        </div>
      </div>
      <div className="mx-auto h-6 w-px bg-gradient-to-b from-[#ff8a3d] to-transparent" />
      <div className="grid grid-cols-2 gap-2">
        {groups.map((g) => (
          <div key={g.name} className="paper flex items-center gap-2 px-3 py-2 text-left text-xs font-bold">
            <span>{g.icon}</span>
            <span className="truncate">{g.name}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="relative mx-auto mt-14 hidden aspect-[16/10] w-full max-w-3xl sm:mt-16 sm:block" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 62.5" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="hubg" x1="0" x2="1">
            <stop offset="0" stopColor="#ff4d8d" />
            <stop offset="0.5" stopColor="#ff8a3d" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {pos.map(([x, y], i) => (
          <path
            key={i}
            d={`M50 31.25 C ${(50 + x) / 2} 31.25, ${(50 + x) / 2} ${(y * 62.5) / 100}, ${x} ${(y * 62.5) / 100}`}
            stroke="url(#hubg)"
            strokeWidth="1.6"
            className="hub-line"
            style={{ animationDelay: `${i * -0.25}s` }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* The key */}
      <div className="absolute left-1/2 top-1/2 w-[46%] max-w-[300px] -translate-x-1/2 -translate-y-1/2">
        <div className="float rounded-2xl bg-grad p-[2px] shadow-[0_30px_70px_-30px_#ff4d8d]">
          <div className="rounded-[14px] bg-[var(--code-bg)] px-3 py-3 text-left sm:px-4 sm:py-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff4d8d]" />
              <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
              <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-white/50 sm:text-[10px]">your key</span>
            </div>
            <p className="mt-2 truncate font-mono text-[10px] text-white/90 sm:mt-3 sm:text-sm">YOUR_API_KEY ••••••••</p>
            <p className="mt-1 truncate font-mono text-[9px] text-[#ffb27a] sm:text-xs">{API_URL}</p>
          </div>
        </div>
      </div>

      {/* Model families */}
      {groups.map((g, i) => (
        <div
          key={g.name}
          className="float absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos[i][0]}%`, top: `${pos[i][1]}%`, animationDelay: `${i * -0.9}s` }}
        >
          <div className="paper flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-[11px] font-bold shadow-[var(--shadow)] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm">
            <span className="text-sm sm:text-base">{g.icon}</span>
            {g.name}
            <span className="hidden rounded-full bg-chip px-1.5 font-mono text-[10px] text-soft sm:inline">{g.models.length}</span>
          </div>
        </div>
      ))}
    </div>
    <span className="sr-only">One API key works with {MODEL_COUNT} models</span>
    </>
  );
}

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="blobs" aria-hidden="true" />
      <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-24 sm:pt-20">
        <p className="eyebrow mb-6 rounded-full border border-line bg-paper/70 px-3.5 py-1.5 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-grad" aria-hidden="true" />
          {MODEL_COUNT} models · one balance
        </p>
        <h1 id="hero-title" className="mx-auto max-w-4xl text-[2.9rem] leading-[1.02] text-balance sm:text-7xl lg:text-[5.4rem]">
          Every top AI.
          <br />
          <em className="text-grad not-italic sm:italic">One API key.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg">
          Coding, app testing, content, images and videos — all from one balance. No separate subscriptions, no monthly
          fee.
        </p>

        {/* Prompt-box: the API URL with copy, and the main action */}
        <div className="mx-auto mt-9 flex max-w-2xl flex-col gap-2 rounded-[22px] border border-line bg-paper p-2 text-left shadow-[0_30px_70px_-30px_rgba(139,92,246,0.45)] sm:flex-row sm:items-center sm:p-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2 sm:px-3">
            <span className="font-mono text-xs text-soft">base_url</span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{API_URL}</code>
            <CopyButton text={API_URL} className="text-muted hover:bg-chip hover:text-ink" />
          </div>
          <a href="#pricing" className="btn btn-grad">
            Get my API key <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
          {['No monthly fee', 'Credits never expire*', 'UPI / Bank transfer', 'Free app included'].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check size={15} className="text-terra" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-soft">*Pay-as-you-go credits.</p>
        <p className="mt-3 text-sm text-muted">
          Already have a key?{' '}
          <a href="/ai/balance" className="font-semibold text-terra underline underline-offset-4">
            Check your balance and expiry
          </a>
        </p>

        <KeyHub />
      </div>
    </section>
  );
}
