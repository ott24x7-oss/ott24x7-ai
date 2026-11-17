import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { getShot, srcSet, type Shot } from '../shots';
import { ImageIcon } from 'lucide-react';
import { ALT, type ShotId } from '../content';

export function Mark({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" width={32} height={32} className={className} decoding="async" />;
}

export function Wordmark({ size = 'text-lg' }: { size?: string }) {
  return (
    <span className={`${size} font-display font-bold tracking-tight`}>
      <span className="text-fg">OTT24x7</span> <span className="text-grad-blue">AI</span>
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark className="h-8 w-8 rounded-[9px]" />
      <Wordmark />
    </span>
  );
}

/** Fades content in once it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      el.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const style = { '--d': `${delay}ms` } as CSSProperties;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export function Img({
  shot,
  sizes,
  eager = false,
  className = '',
  style,
}: {
  shot: Shot;
  sizes: string;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={shot.srcs[Math.min(1, shot.srcs.length - 1)].url}
      srcSet={srcSet(shot)}
      sizes={sizes}
      width={shot.width}
      height={shot.height}
      alt={shot.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      // React 18 warns on camelCase fetchPriority; the lowercase attribute is passed through.
      {...(eager ? { fetchpriority: 'high' } : {})}
      className={className}
      style={style}
    />
  );
}

/** A browser-window frame for desktop screenshots. */
export function BrowserFrame({
  id,
  sizes,
  eager,
  laptop = false,
  className = '',
  placeholderClass = '',
}: {
  id: ShotId;
  sizes: string;
  eager?: boolean;
  laptop?: boolean;
  className?: string;
  placeholderClass?: string;
}) {
  const shot = getShot(id);
  const frame = (
    <div className="overflow-hidden rounded-xl border border-[var(--frame-edge)] bg-[var(--frame)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex h-7 items-center gap-1.5 border-b border-[var(--frame-edge)] px-3" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        <span className="ml-3 hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:block">OTT24x7 AI</span>
        <span className="ml-auto hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e]" />
          live
        </span>
      </div>
      {shot ? (
        <Img shot={shot} sizes={sizes} eager={eager} className="block h-auto w-full" />
      ) : (
        <Placeholder id={id} className={`aspect-[16/10] ${placeholderClass}`} />
      )}
    </div>
  );
  if (!laptop) return <div className={className}>{frame}</div>;
  return (
    <div className={className}>
      <div className="hud rounded-[18px] border border-[var(--frame-edge)] bg-[var(--frame)] p-[1.2%] pb-[1.6%] shadow-[0_40px_120px_-40px_var(--glow-red),0_20px_80px_-40px_var(--glow-blue)]">
        {frame}
      </div>
      <div
        aria-hidden="true"
        className="relative mx-auto h-3 w-[112%] -translate-x-[5.4%] rounded-b-[14px] border border-t-0 border-[var(--frame-edge)] bg-[var(--frame)] sm:h-4"
      >
        <span className="absolute left-1/2 top-0 h-1.5 w-[14%] -translate-x-1/2 rounded-b-md bg-[var(--frame-edge)]" />
      </div>
    </div>
  );
}

/**
 * A clearly marked empty slot for a desktop screenshot that is not added yet.
 * It shows the planned file name so the real PNG can be dropped in later
 * (screenshots/desktop/<name>.png, then `npm run images`). It never imitates app UI.
 */
export function Placeholder({ id, className = '', compact = false }: { id: ShotId; className?: string; compact?: boolean }) {
  const file = `${id.split('/')[1]}.png`;
  return (
    <div
      role="img"
      aria-label={`Windows screenshot coming soon: ${ALT[id]}`}
      data-placeholder={file}
      className={`relative grid place-items-center overflow-hidden bg-surface-2 ${className}`}
    >
      <div className="grid-fade absolute inset-0 opacity-30" aria-hidden="true" />
      <div className="relative m-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--frame-edge)] px-4 py-3 text-center">
        <ImageIcon size={compact ? 18 : 24} className="text-accent-text" aria-hidden="true" />
        <span className={`font-medium text-fg/80 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>Windows screenshot coming soon</span>
        <code className="font-mono text-[10px] break-all text-muted sm:text-[11px]">{file}</code>
      </div>
    </div>
  );
}

/** A phone frame for Android screenshots. */
export function PhoneFrame({
  id,
  sizes,
  eager,
  className = '',
}: {
  id: ShotId;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  const shot = getShot(id);
  if (!shot) return null;
  return (
    <div
      className={`rounded-[2.2rem] border border-[var(--frame-edge)] bg-[#0a0b0e] p-[3.5%] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[1.75rem]">
        <Img shot={shot} sizes={sizes} eager={eager} className="block h-auto w-full" />
      </div>
    </div>
  );
}

/** Renders the right frame for the screenshot kind. */
export function Framed({ id, sizes, className = '' }: { id: ShotId; sizes: string; className?: string }) {
  return id.startsWith('android/') ? (
    <PhoneFrame id={id} sizes={sizes} className={`mx-auto w-[min(260px,70%)] ${className}`} />
  ) : (
    <BrowserFrame id={id} sizes={sizes} className={className} />
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  id,
  index,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  id?: string;
  index?: string;
}) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
      <p className="pill mb-5">
        {index && <span className="text-red-text">{index}</span>}
        {index && <span className="h-3 w-px bg-line-strong" aria-hidden="true" />}
        {eyebrow}
      </p>
      <h2 id={id} className="text-3xl font-bold text-balance sm:text-[2.6rem] sm:leading-[1.08]">
        {title}
      </h2>
      {sub && <p className="mt-4 text-base text-pretty text-muted sm:text-lg">{sub}</p>}
    </Reveal>
  );
}
