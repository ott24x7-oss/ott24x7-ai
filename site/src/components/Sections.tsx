import { Columns3, Globe, KeyRound, LayoutPanelLeft, Monitor, Plug, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FEATURES, HOW } from '../content';
import { getShot, pick } from '../shots';
import { Framed, Img, Placeholder, Reveal, SectionHead } from './ui';

const ICONS: Record<string, LucideIcon> = {
  columns: Columns3,
  sparkles: Sparkles,
  globe: Globe,
  panels: LayoutPanelLeft,
  plug: Plug,
  phone: Smartphone,
};

export function TrustStrip() {
  const items = [
    { icon: KeyRound, text: 'Use your own logins — no API keys needed for ChatGPT, Claude, Gemini, DeepSeek' },
    { icon: ShieldCheck, text: 'Your data stays on your PC' },
    { icon: Monitor, text: 'Windows 10/11 + Android 8+' },
  ];
  return (
    <section aria-label="Why people trust it" className="relative border-y border-line bg-surface/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red/60 to-transparent" aria-hidden="true" />
      <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3 sm:gap-6 sm:px-6 sm:py-8">
        {items.map(({ icon: Icon, text }, i) => (
          <Reveal as="li" key={text} delay={i * 60} className="flex items-start gap-3">
            <span className={`chip h-9 w-9 shrink-0 ${i === 1 ? 'blue' : ''}`}>
              <Icon size={16} aria-hidden="true" />
            </span>
            <span className="text-sm leading-relaxed text-fg/85">{text}</span>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function FeatureVisual({ f }: { f: (typeof FEATURES)[number] }) {
  const id = f.shot ? pick(f.shot, f.fallback) : undefined;
  const shot = id ? getShot(id) : undefined;
  if (f.code) {
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 p-4 font-mono text-[11.5px] leading-relaxed text-muted sm:text-xs">
        {f.code.map((line) => {
          const [k, ...rest] = line.split(/\s{2,}/);
          return (
            <div key={line} className="truncate">
              <span className="text-accent-text">{k}</span> <span className="text-fg/80">{rest.join(' ')}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (!shot) return id ? <Placeholder id={id} compact className="h-full w-full" /> : null;
  if (shot.kind === 'android') {
    return (
      <div className="flex h-full items-start justify-center pt-4">
        <div className="w-[46%] overflow-hidden rounded-t-[1.1rem] border border-b-0 border-[var(--frame-edge)] bg-[#0a0b0e] p-1.5 pb-0">
          <Img shot={shot} sizes="160px" className="block w-full rounded-t-[0.8rem]" />
        </div>
      </div>
    );
  }
  return (
    <Img
      shot={shot}
      sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw"
      className="h-full w-full object-cover"
      style={{ objectPosition: f.pos || 'left top' }}
    />
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead
        index="01"
        id="features-title"
        eyebrow="Features"
        title="Everything in one place"
        sub="Stop copying the same question into four tabs."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map((f, i) => {
          const Icon = ICONS[f.icon];
          const visible = Boolean(f.code || f.shot);
          return (
            <Reveal
              as="li"
              key={f.title}
              delay={(i % 3) * 70}
              className="tech-card group flex flex-col"
            >
              <div className="p-5 sm:p-6">
                <span className={`chip mb-4 ${i % 2 ? 'blue' : ''}`}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
              {visible && (
                <div className="mt-auto h-40 overflow-hidden rounded-b-[1rem] border-t border-line bg-surface-2 sm:h-44">
                  <FeatureVisual f={f} />
                </div>
              )}
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="relative border-t border-line bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead index="02" id="how-title" eyebrow="How it works" title="Three steps. That’s it." />
        <ol className="grid gap-10 lg:grid-cols-3 lg:gap-6">
          {HOW.map((s, i) => {
            const id = pick(s.shot, s.fallback);
            return (
              <Reveal as="li" key={s.title} delay={i * 90} className="flex flex-col">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-red/40 bg-red/10 font-mono text-sm font-semibold text-red-text shadow-[0_0_24px_-8px_var(--glow-red)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  {i < HOW.length - 1 && (
                    <span className="ml-auto hidden h-px flex-1 bg-gradient-to-r from-red/50 via-line-strong to-blue/40 lg:block" aria-hidden="true" />
                  )}
                </div>
                <p className="mb-5 text-sm leading-relaxed text-muted">{s.text}</p>
                <Framed id={id} sizes="(min-width: 1024px) 360px, 92vw" className="mt-auto" />
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
