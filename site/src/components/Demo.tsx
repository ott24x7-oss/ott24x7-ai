import { useEffect, useRef, useState } from 'react';
import { DEMOS } from '../content';
import { Reveal, SectionHead } from './ui';

const base = import.meta.env.BASE_URL;

/** Short recordings of each feature. One video plays at a time, only while on screen. */
export function Demo() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const demo = DEMOS[active];

  useEffect(() => {
    const el = wrap.current;
    if (!el || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    setProgress(0);
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [active, visible]);

  const next = () => setActive((i) => (i + 1) % DEMOS.length);

  return (
    <section id="demo" aria-labelledby="demo-title" className="relative border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead
          index="02"
          id="demo-title"
          eyebrow="Demo"
          title="Watch every feature in action"
          sub="Real recordings of the Windows app. Pick a feature to see it."
        />
        <Reveal className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
          <ol role="tablist" aria-label="Features" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {DEMOS.map((d, i) => {
              const on = i === active;
              return (
                <li key={d.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="demo-video"
                    onClick={() => setActive(i)}
                    className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-200 ${
                      on ? 'border-red/50 bg-surface-2' : 'border-line bg-surface/40 hover:border-line-strong'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`font-mono text-[11px] ${on ? 'text-red-text' : 'text-muted'}`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={`whitespace-nowrap text-sm font-medium ${on ? 'text-fg' : 'text-fg/75'}`}>{d.title}</span>
                    </span>
                    {on && <p className="mt-1.5 hidden text-[13px] leading-relaxed text-muted lg:block">{d.text}</p>}
                    {on && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-red"
                        style={{ transform: `scaleX(${progress})` }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <div ref={wrap}>
            <div className="overflow-hidden rounded-xl border border-[var(--frame-edge)] bg-[var(--frame)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex h-7 items-center gap-1.5 border-b border-[var(--frame-edge)] px-3" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
                <span className="ml-3 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{demo.title}</span>
              </div>
              <video
                id="demo-video"
                key={demo.id}
                ref={video}
                className="block aspect-[16/9] w-full bg-[#0b0d11]"
                src={`${base}demo/${demo.id}.webm`}
                poster={`${base}demo/${demo.id}.jpg`}
                muted
                playsInline
                autoPlay={visible}
                preload="metadata"
                aria-label={`${demo.title}: ${demo.text}`}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress(v.currentTime / v.duration);
                }}
                onEnded={next}
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted lg:hidden">{demo.text}</p>
            <a
              href={`${base}watch`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-fg/90 transition-colors duration-200 hover:border-red/50"
            >
              ▶ Watch the full 3-minute tour with voice
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
