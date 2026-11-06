import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { GALLERY, type ShotId } from '../content';
import { getShot, largest, type Shot } from '../shots';
import { Img, Placeholder, Reveal, SectionHead } from './ui';

type Kind = 'desktop' | 'android';

function Lightbox({ shots, index, onClose, onMove }: { shots: Shot[]; index: number | null; onClose: () => void; onMove: (d: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) d.close();
  }, [index]);

  const shot = index !== null ? shots[index] : undefined;
  return (
    <dialog
      ref={ref}
      aria-label="Screenshot viewer"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onMove(1);
        if (e.key === 'ArrowLeft') onMove(-1);
      }}
      className="m-auto max-h-[100dvh] max-w-[100vw] overflow-visible bg-transparent p-0 text-white backdrop:bg-black/80"
    >
      {shot && (
        <figure className="flex flex-col items-center gap-3 p-4">
          <img
            src={largest(shot)}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            className={`h-auto rounded-xl border border-white/10 shadow-2xl ${
              shot.kind === 'android' ? 'max-h-[82dvh] w-auto' : 'max-h-[82dvh] w-[min(1400px,94vw)] object-contain'
            }`}
          />
          <figcaption className="max-w-2xl text-center text-sm text-white/75">
            {shot.alt} <span className="ml-2 font-mono text-white/45">{(index ?? 0) + 1}/{shots.length}</span>
          </figcaption>
          <div className="fixed right-4 top-4 flex gap-2">
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" autoFocus>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {shots.length > 1 && (
            <>
              <button type="button" onClick={() => onMove(-1)} aria-label="Previous screenshot" className="fixed left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onMove(1)} aria-label="Next screenshot" className="fixed right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
        </figure>
      )}
    </dialog>
  );
}

export function Gallery() {
  const available = {
    desktop: GALLERY.desktop.map(getShot).filter(Boolean) as Shot[],
    android: GALLERY.android.map(getShot).filter(Boolean) as Shot[],
  };
  const kinds: Kind[] = ['desktop', 'android'];
  const [tab, setTab] = useState<Kind>('desktop');
  const [open, setOpen] = useState<number | null>(null);
  const track = useRef<HTMLUListElement>(null);
  const shots = available[tab];
  const ids: ShotId[] = GALLERY[tab];

  const move = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + shots.length) % shots.length)), [shots.length]);
  const scroll = (d: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section id="gallery" aria-labelledby="gallery-title" className="border-t border-line bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead index="04" id="gallery-title" eyebrow="Screenshots" title="See it in action" />

        <div className="mb-8 flex items-center justify-between gap-4">
          <div role="tablist" aria-label="Screenshot platform" className="flex rounded-xl border border-line bg-surface p-1">
            {kinds.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                aria-controls="gallery-track"
                onClick={() => {
                  setTab(k);
                  track.current?.scrollTo({ left: 0 });
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors duration-150 ${
                  tab === k ? 'bg-red-grad text-white shadow-[0_8px_20px_-10px_var(--glow-red)]' : 'text-muted hover:text-fg'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => scroll(-1)} aria-label="Scroll screenshots left" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:border-accent/50">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label="Scroll screenshots right" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:border-accent/50">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <Reveal>
          <ul
            id="gallery-track"
            ref={track}
            className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6"
          >
            {ids.map((id) => {
              const s = getShot(id);
              const android = id.startsWith('android/');
              return (
                <li key={id} className={`shrink-0 snap-start ${android ? 'w-[46%] sm:w-[230px]' : 'w-[86%] sm:w-[520px]'}`}>
                  {s ? (
                    <button
                      type="button"
                      onClick={() => setOpen(shots.findIndex((x) => x.id === id))}
                      aria-label={`Open screenshot: ${s.alt}`}
                      className="group block w-full overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/50"
                    >
                      <Img
                        shot={s}
                        sizes={android ? '230px' : '(min-width: 640px) 520px, 86vw'}
                        className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.015]"
                      />
                    </button>
                  ) : (
                    <Placeholder id={id} className="aspect-[16/10] rounded-2xl border border-line" />
                  )}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
      <Lightbox shots={shots} index={open} onClose={() => setOpen(null)} onMove={move} />
    </section>
  );
}
