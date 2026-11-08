import { useEffect, useState, type ReactNode } from 'react';
import { Github, Menu, Moon, Sun, X } from 'lucide-react';
import { LINKS, NAV } from '../content';
import { Logo } from './ui';

type Theme = 'dark' | 'light';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ott-ai-theme', theme);
    } catch {
      /* storage blocked: theme still works for this visit */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors duration-150 hover:text-fg"
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}

export function Header({
  nav = NAV,
  cta,
  homeHref = '#top',
}: {
  nav?: { href: string; label: string }[];
  /** Replaces the GitHub button (e.g. a "Get API key" button). */
  cta?: ReactNode;
  homeHref?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ${
        scrolled || open
          ? 'border-b border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href={homeHref} aria-label="OTT24x7 AI home" className="shrink-0">
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <li key={n.href}>
              <a
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 hover:text-fg"
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {cta ?? (
          <a
            href={LINKS.repo}
            target="_blank"
            rel="noopener"
            className="hidden h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium transition-colors duration-150 hover:border-accent/60 sm:inline-flex"
          >
            <Github size={16} aria-hidden="true" />
            GitHub
          </a>
          )}
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-line px-4 pb-5 pt-2 md:hidden">
          <ul className="flex flex-col">
            {nav.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-3 text-base text-fg/90 hover:bg-surface"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={LINKS.repo} target="_blank" rel="noopener" className="btn btn-secondary mt-3 w-full">
            <Github size={16} aria-hidden="true" /> View on GitHub
          </a>
        </div>
      )}
    </header>
  );
}
