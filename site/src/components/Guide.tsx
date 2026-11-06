import { useRef, useState, type KeyboardEvent } from 'react';
import { Info, Monitor, Smartphone } from 'lucide-react';
import { GUIDE_ANDROID, GUIDE_DESKTOP, LINKS, type Step } from '../content';
import { Framed, Reveal, SectionHead } from './ui';

function Steps({ steps }: { steps: Step[] }) {
  let shotIndex = 0;
  return (
    <ol className="relative space-y-6 sm:space-y-10">
      {steps.map((s, i) => {
        const shots = s.shots;
        const flip = shots.length > 0 && shotIndex++ % 2 === 1;
        const text = (
          <div className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red/40 bg-red/10 font-mono text-sm font-semibold text-red-text">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="pt-1">
              <h4 className="text-lg font-semibold tracking-tight">{s.title}</h4>
              <p className="mt-1.5 max-w-prose text-[0.95rem] leading-relaxed text-muted">{s.text}</p>
            </div>
          </div>
        );
        if (!shots.length) {
          return (
            <Reveal as="li" key={s.title} className="tech-card p-5 sm:p-6">
              {text}
            </Reveal>
          );
        }
        const android = shots[0].startsWith('android/');
        return (
          <Reveal
            as="li"
            key={s.title}
            className={`grid items-center gap-6 md:gap-10 ${android ? 'md:grid-cols-[1fr_minmax(0,320px)]' : 'md:grid-cols-2'}`}
          >
            <div className={flip ? 'md:order-2' : ''}>{text}</div>
            <div className={`space-y-4 ${flip ? 'md:order-1' : ''}`}>
              {shots.map((id) => (
                <Framed key={id} id={id} sizes={android ? '260px' : '(min-width: 1024px) 540px, 92vw'} />
              ))}
            </div>
          </Reveal>
        );
      })}
    </ol>
  );
}

const TABS = [
  { key: 'desktop', label: 'Windows', icon: Monitor },
  { key: 'android', label: 'Android', icon: Smartphone },
] as const;

export function Guide() {
  const [tab, setTab] = useState<'desktop' | 'android'>('desktop');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.key === tab);
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[n].key);
    refs.current[n]?.focus();
  };

  return (
    <section id="guide" aria-labelledby="guide-title" className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead
        index="03"
        id="guide-title"
        eyebrow="User guide"
        title="How to use, step by step"
        sub="From download to your first combined answer in a few minutes."
      />

      <div role="tablist" aria-label="Platform" className="mx-auto mb-12 flex w-fit rounded-xl border border-line bg-surface p-1" onKeyDown={onKey}>
        {TABS.map((t, i) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`guide-tab-${t.key}`}
              aria-selected={active}
              aria-controls={`guide-panel-${t.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                active ? 'bg-red-grad text-white shadow-[0_8px_20px_-10px_var(--glow-red)]' : 'text-muted hover:text-fg'
              }`}
            >
              <t.icon size={16} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="guide-panel-desktop" aria-labelledby="guide-tab-desktop" hidden={tab !== 'desktop'}>
        <h3 className="sr-only">Windows</h3>
        <Steps steps={GUIDE_DESKTOP} />
      </div>
      <div role="tabpanel" id="guide-panel-android" aria-labelledby="guide-tab-android" hidden={tab !== 'android'}>
        <h3 className="sr-only">Android</h3>
        <Steps steps={GUIDE_ANDROID} />
      </div>

      <aside
        aria-label="Note about Google sign-in"
        className="mt-12 flex gap-3 rounded-2xl border border-blue/30 bg-blue/[0.07] p-5 text-sm leading-relaxed"
      >
        <Info size={18} className="mt-0.5 shrink-0 text-blue-text" aria-hidden="true" />
        <p>
          <strong className="font-semibold">Note:</strong> Google blocks sign-in inside apps — use email login, or
          “Open in Chrome tab”.{' '}
          <a href={LINKS.releases} target="_blank" rel="noopener" className="text-blue-text underline underline-offset-4 hover:decoration-2">
            Release notes
          </a>
        </p>
      </aside>
    </section>
  );
}
