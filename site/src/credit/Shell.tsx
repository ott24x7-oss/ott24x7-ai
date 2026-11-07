import { useEffect, useState } from 'react';
import { Check, Download, Menu, MessageCircle, Moon, Smartphone, Sun, X } from 'lucide-react';
import { LINKS } from '../content';
import { getShot } from '../shots';
import { Img, Reveal } from '../components/ui';
import { API_NAV, APP_POINTS, buyUrl } from './content';

const KEY = 'ott-credit-theme';

function Mark({ size = 32 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" width={size} height={size} className="rounded-[9px]" />;
}

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))] as const;
}

export function Nav() {
  const [theme, toggle] = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color] duration-200 ${
        scrolled || open ? 'border-b border-line bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="OTT24x7 AI API home">
          <Mark />
          <span className="text-lg font-extrabold tracking-tight">
            OTT24x7 <span className="text-grad">AI</span>
            <span className="ml-1.5 rounded-md bg-chip px-1.5 py-0.5 align-middle font-mono text-[10px] font-medium text-muted">API</span>
          </span>
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {API_NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${next} mode`}
            title={`Switch to ${next} mode`}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted hover:text-ink"
          >
            {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          </button>
          <a href="#pricing" className="btn btn-terra hidden h-9 min-h-0 rounded-xl px-4 text-sm sm:inline-flex">
            Get API key
          </a>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line md:hidden"
            aria-expanded={open}
            aria-controls="credit-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="credit-menu" className="border-t border-line px-4 pb-5 pt-2 md:hidden">
          <ul>
            {API_NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 font-semibold">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="#pricing" onClick={() => setOpen(false)} className="btn btn-terra mt-3 w-full">
            Get API key
          </a>
        </div>
      )}
    </header>
  );
}

/** The free app, shown with the real screenshots. */
export function FreeApp() {
  const desk = getShot('desktop/01-compare-4-ai-answers');
  const phone = getShot('android/answers-dark');
  return (
    <section id="app" aria-labelledby="app-title" className="relative overflow-hidden border-t border-line">
      <div className="blobs opacity-50" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <p className="eyebrow mb-4">🎁 Free with every plan</p>
          <h2 id="app-title" className="text-4xl leading-[1.05] sm:text-5xl">
            The <em className="text-grad">OTT24x7 AI</em> app, included
          </h2>
          <ul className="mt-6 space-y-3">
            {APP_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-terra-soft text-terra">
                  <Check size={14} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.windows} className="btn btn-terra">
              <Download size={17} aria-hidden="true" /> Download for Windows
            </a>
            <a href={LINKS.android} className="btn btn-ghost">
              <Smartphone size={17} aria-hidden="true" /> Download Android APK
            </a>
          </div>
          <a href="/ai" className="mt-4 inline-block text-sm font-semibold text-terra underline underline-offset-4">
            See everything the app can do →
          </a>
        </Reveal>
        <Reveal delay={80} className="relative pb-8 pr-[12%]">
          {desk && (
            <div className="overflow-hidden rounded-2xl border border-line-2 bg-paper shadow-[var(--shadow)]">
              <div className="flex h-7 items-center gap-1.5 border-b border-line px-3" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff4d8d]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]/80" />
              </div>
              <Img shot={desk} sizes="(min-width: 1024px) 560px, 88vw" className="block h-auto w-full" />
            </div>
          )}
          {phone && (
            <div className="float absolute bottom-0 right-0 w-[30%] max-w-[200px] rounded-[1.8rem] border border-line-2 bg-[#0a0b0e] p-[3%] shadow-[var(--shadow)]">
              <Img shot={phone} sizes="200px" className="block h-auto w-full rounded-[1.4rem]" />
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  const links = [
    { label: 'OTT24x7 AI app', href: '/ai' },
    { label: 'AI tools — ott24x7.com', href: LINKS.shop },
    { label: 'Windows & Office keys — keys24x7.com', href: LINKS.keys },
    { label: 'Contact', href: LINKS.contact },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="text-lg font-extrabold">
              OTT24x7 <span className="text-grad">AI</span>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">All top AI models, one API key. Pay as you go.</p>
          <a href={buyUrl('api-key')} className="btn btn-terra mt-5 h-10 min-h-0 text-sm">
            <MessageCircle size={16} aria-hidden="true" /> Buy on WhatsApp
          </a>
        </div>
        <nav aria-label="Footer">
          <ul className="grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-10">
            {links.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="text-muted transition-colors duration-150 hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="border-t border-line px-4 py-6 text-center text-xs text-soft">
        © {new Date().getFullYear()} OTT24x7. Model names belong to their owners.
      </p>
    </footer>
  );
}
