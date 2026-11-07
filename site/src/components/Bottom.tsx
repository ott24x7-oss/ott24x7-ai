import { ArrowRight, ArrowUpRight, Download as DownloadIcon, Github, KeyRound, Monitor, Plus, ShoppingBag, Smartphone } from 'lucide-react';
import { FAQ, LINKS } from '../content';
import { Logo, Reveal, SectionHead } from './ui';

export function Download() {
  const cards = [
    {
      icon: Monitor,
      title: 'Windows',
      file: 'OTT24x7-AI-Setup.exe',
      meta: '~200 MB · Windows 10/11, 64-bit',
      hint: 'If SmartScreen appears: More info → Run anyway.',
      href: LINKS.windows,
      cta: 'Download for Windows',
      primary: true,
    },
    {
      icon: Smartphone,
      title: 'Android',
      file: 'OTT24x7-AI.apk',
      meta: '~12 MB · Android 8+',
      hint: 'Enable “Install unknown apps” for your browser first.',
      href: LINKS.android,
      cta: 'Download Android APK',
      primary: false,
    },
  ];
  return (
    <section id="download" aria-labelledby="download-title" className="relative overflow-hidden border-t border-line">
      <div className="hero-glow opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead index="05" id="download-title" eyebrow="Download" title="Get OTT24x7 AI" sub="Free forever. No account needed." />
        <div className="grid gap-5 md:grid-cols-2">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 80} className="tech-card relative flex flex-col p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <span className={`chip h-12 w-12 ${i ? 'blue' : ''}`}>
                  <c.icon size={22} aria-hidden="true" />
                </span>
                <h3 className="text-2xl font-bold tracking-tight">{c.title}</h3>
              </div>
              <p className="font-mono text-sm text-fg/90">{c.file}</p>
              <p className="mt-1 text-sm text-muted">{c.meta}</p>
              <p className="mt-3 text-xs leading-relaxed text-muted">{c.hint}</p>
              <a href={c.href} className={`btn mt-8 h-12 w-full text-base ${c.primary ? 'btn-primary' : 'btn-secondary'}`}>
                <DownloadIcon size={18} aria-hidden="true" />
                {c.cta}
              </a>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-sm sm:flex-row sm:gap-6">
          <a href={LINKS.repo} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-fg/85 hover:text-accent-text">
            <Github size={16} aria-hidden="true" />
            Source code (AGPL-3.0) on GitHub
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <span className="hidden text-line sm:inline" aria-hidden="true">|</span>
          <a href={LINKS.releases} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-fg/85 hover:text-accent-text">
            All releases
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-line bg-surface/30">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead index="06" id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <Reveal className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left font-medium transition-colors duration-150 hover:bg-surface-2 sm:px-6 sm:py-5">
                {f.q}
                <Plus size={18} className="chev shrink-0 text-muted transition-transform duration-200" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-[0.95rem] leading-relaxed text-muted sm:px-6">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function Promo() {
  const items = [
    { icon: ShoppingBag, text: 'AI tools at the best price', site: 'ott24x7.com', href: LINKS.shop },
    { icon: KeyRound, text: 'Genuine Windows & Office keys', site: 'keys24x7.com', href: LINKS.keys },
  ];
  return (
    <section aria-label="From the makers" className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6">
        {items.map((p) => (
          <a
            key={p.site}
            href={p.href}
            target="_blank"
            rel="noopener"
            className="group flex items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-red/[0.10] via-transparent to-blue/[0.08] p-5 transition-[border-color] duration-200 hover:border-accent/50 sm:p-6"
          >
            <span className="chip h-11 w-11 shrink-0">
              <p.icon size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{p.text}</span>
              <span className="mt-0.5 block font-mono text-sm text-accent-text">{p.site}</span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  const links = [
    { label: 'GitHub', href: LINKS.repo },
    { label: 'Releases', href: LINKS.releases },
    { label: 'License AGPL-3.0', href: LINKS.license },
    { label: 'Contact', href: LINKS.contact },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted">Ask once, get every AI’s answer — and one best answer from all of them.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
            {links.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noopener" className="text-muted transition-colors duration-150 hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6">
          © {new Date().getFullYear()} OTT24x7. ChatGPT, Claude, Gemini and DeepSeek are trademarks of their owners.
        </p>
      </div>
    </footer>
  );
}
