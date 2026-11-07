import { useState } from 'react';
import { ArrowRight, Check, MessageCircle, Plus } from 'lucide-react';
import { Reveal } from '../components/ui';
import {
  API_FAQ,
  API_URL,
  CODE,
  ENDPOINTS,
  MODEL_GROUPS,
  PLAN_TABS,
  STEPS,
  USE_CASES,
  buyUrl,
} from './content';
import { CopyButton } from './Hero';

function Head({ eyebrow, title, sub, id }: { eyebrow: string; title: React.ReactNode; sub?: string; id: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 id={id} className="text-4xl leading-[1.05] text-balance sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-base text-pretty text-muted sm:text-lg">{sub}</p>}
    </Reveal>
  );
}

/* ── Model marquee ─────────────────────────────────────────────────────── */
export function Marquee() {
  const all = MODEL_GROUPS.flatMap((g) => g.models.map((m) => ({ m, icon: g.icon })));
  const row = [...all, ...all];
  return (
    <section aria-label="Models included" className="border-y border-line bg-bg-2/60 py-5">
      <div className="marquee overflow-hidden">
        <div className="marquee-track">
          {row.map((x, i) => (
            <span key={i} className="chip bg-paper text-[0.8rem] text-ink" aria-hidden={i >= all.length}>
              <span>{x.icon}</span>
              {x.m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Use cases with small illustrations ────────────────────────────────── */
function Art({ kind }: { kind: (typeof USE_CASES)[number]['art'] }) {
  if (kind === 'code')
    return (
      <div className="h-full rounded-xl bg-[var(--code-bg)] p-3 font-mono text-[10px] leading-relaxed text-white/80">
        <span className="text-[#ff8a3d]">def</span> <span className="text-[#c9b8ff]">fix_bug</span>(code):
        <br />
        &nbsp;&nbsp;<span className="text-white/65"># ask any model</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#ff8a3d]">return</span> ai(code)
      </div>
    );
  if (kind === 'test')
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 rounded-xl bg-chip p-3 text-[11px] font-semibold">
        {['login works', 'checkout total', 'empty cart'].map((t, i) => (
          <div key={t} className="flex items-center gap-2">
            <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] text-white ${i === 2 ? 'bg-[#ff8a3d]' : 'bg-[#22a06b]'}`}>
              {i === 2 ? '!' : '✓'}
            </span>
            {t}
          </div>
        ))}
      </div>
    );
  if (kind === 'text')
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 rounded-xl bg-chip p-3">
        {[90, 72, 84, 52].map((w, i) => (
          <span key={i} className="h-1.5 rounded-full bg-line-2" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  if (kind === 'image')
    return (
      <div className="relative h-full overflow-hidden rounded-xl bg-[linear-gradient(135deg,#ffb3c7,#ffd3a1_45%,#c9b8ff)]">
        <span className="absolute left-[18%] top-[22%] h-8 w-8 rounded-full bg-white/70" />
        <span className="absolute bottom-0 left-0 h-[45%] w-[70%] rounded-tr-[60%] bg-[#8b5cf6]/50" />
        <span className="absolute bottom-0 right-0 h-[60%] w-[55%] rounded-tl-[70%] bg-[#ff4d8d]/45" />
      </div>
    );
  return (
    <div className="relative grid h-full place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#2a1b3d,#5b2a4a)]">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm text-[#5b2a4a]">▶</span>
      <span className="absolute inset-x-3 bottom-2 h-1 rounded-full bg-white/25">
        <span className="block h-full w-2/5 rounded-full bg-grad" />
      </span>
    </div>
  );
}

export function UseCases() {
  return (
    <section aria-labelledby="uses-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <Head id="uses-title" eyebrow="One balance, many jobs" title={<>Build anything with <em className="text-grad">every model</em></>} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {USE_CASES.map((u, i) => (
          <Reveal as="li" key={u.title} delay={i * 60} className="paper flex flex-col p-4 transition-transform duration-200 hover:-translate-y-1">
            <div className="h-28">
              <Art kind={u.art} />
            </div>
            <h3 className="mt-4 flex items-center gap-2 font-sans text-base font-bold tracking-normal">
              <span>{u.icon}</span>
              {u.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{u.text}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/* ── Models ────────────────────────────────────────────────────────────── */
export function Models() {
  return (
    <section id="models" aria-labelledby="models-title" className="border-t border-line bg-bg-2/50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Head id="models-title" eyebrow="Models included" title="All the top models, one place" sub="Use any of them with the same key and the same balance." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODEL_GROUPS.map((g, i) => (
            <Reveal as="li" key={g.name} delay={(i % 3) * 70} className="paper p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-chip text-xl">{g.icon}</span>
                <div>
                  <h3 className="text-2xl leading-none">{g.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-soft">{g.models.length} models</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {g.models.map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────── */
export function Pricing() {
  const [tab, setTab] = useState<(typeof PLAN_TABS)[number]['key']>('payg');
  const t = PLAN_TABS.find((x) => x.key === tab)!;
  const max = Math.max(...t.plans.map((p) => p.value));
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <Head id="pricing-title" eyebrow="Pricing" title={<>Simple plans. <em className="text-grad">Pay once.</em></>} sub="No monthly fee and no auto-renewal. Top up again only when you want." />

      <div role="tablist" aria-label="Plan type" className="mx-auto mb-10 flex w-fit flex-wrap justify-center gap-1 rounded-2xl border border-line bg-paper p-1.5">
        {PLAN_TABS.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            aria-controls="plans"
            onClick={() => setTab(x.key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors duration-150 ${
              tab === x.key ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div id="plans" role="tabpanel" aria-label={t.label}>
      <ul className="flex flex-wrap justify-center gap-4">
        {t.plans.map((p) => (
          <li key={p.id} className={`relative flex w-full flex-col rounded-[22px] p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.7rem)] xl:w-[calc(20%-0.8rem)] ${p.badge ? 'pop' : 'paper'}`}>
            {p.badge && (
              <span className="absolute -top-3 left-5 rounded-full bg-grad px-3 py-1 text-[11px] font-extrabold text-white shadow">
                {p.badge}
              </span>
            )}
            <p className="text-sm font-bold text-soft">{p.name}</p>
            <p className="mt-2 font-serif text-[2.6rem] leading-none tracking-tight">{p.inr}</p>
            <p className="mt-1 text-sm text-soft">
              {p.usd} · {t.per}
            </p>
            <p className="mt-4 text-lg font-extrabold">{p.credits}</p>
            {p.note && <p className="text-sm font-semibold text-terra">{p.note}</p>}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-chip" aria-hidden="true">
              <span className="block h-full rounded-full bg-grad" style={{ width: `${Math.max(8, (p.value / max) * 100)}%` }} />
            </div>
            <a href={buyUrl(p.id)} className={`btn mt-5 w-full ${p.badge ? 'btn-grad' : 'btn-ghost'}`}>
              <MessageCircle size={16} aria-hidden="true" /> Buy on WhatsApp
            </a>
          </li>
        ))}
        {tab === 'payg' && (
          <li className="paper flex w-full flex-col justify-between border-dashed p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold">Custom amount</p>
              <p className="text-sm text-muted">Any amount from ₹150 ($1.50) = $20 credit (worth ₹2,000).</p>
            </div>
            <a href={buyUrl('payg-custom')} className="btn btn-ghost mt-4 sm:mt-0">
              Ask for a custom top-up <ArrowRight size={16} aria-hidden="true" />
            </a>
          </li>
        )}
      </ul>
      </div>

      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
        {[...t.points, 'Credit is in US dollars ($1 = ₹100)', 'UPI / Bank transfer accepted', 'Free OTT24x7 AI app with every plan'].map((x) => (
          <li key={x} className="flex items-center gap-1.5">
            <Check size={15} className="text-terra" aria-hidden="true" />
            {x}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── How it works ──────────────────────────────────────────────────────── */
export function Steps() {
  return (
    <section aria-labelledby="steps-title" className="border-t border-line bg-bg-2/50">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
        <Head id="steps-title" eyebrow="How it works" title="Your key in three steps" />
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 90} className="relative text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-grad font-serif text-3xl text-white shadow-[0_18px_40px_-18px_#ff4d8d]">
                {i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span className="absolute left-[calc(50%+3rem)] top-8 hidden h-px w-[calc(100%-6rem)] border-t-2 border-dashed border-line-2 md:block" aria-hidden="true" />
              )}
              <h3 className="mt-5 text-2xl">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Developers ────────────────────────────────────────────────────────── */
export function Developers() {
  const [lang, setLang] = useState(CODE[0].key);
  const c = CODE.find((x) => x.key === lang)!;
  return (
    <section id="developers" aria-labelledby="dev-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal className="min-w-0">
          <p className="eyebrow mb-4">Developer ready</p>
          <h2 id="dev-title" className="text-4xl leading-[1.05] sm:text-5xl">
            Drop-in for the <em className="text-grad">OpenAI & Anthropic</em> SDKs
          </h2>
          <p className="mt-4 text-muted">Change the base URL, paste your key, keep your code.</p>
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-paper p-2 pl-4">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{API_URL}</code>
            <CopyButton text={API_URL} className="bg-chip text-ink hover:bg-line" />
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ENDPOINTS.map((e) => (
              <li key={e} className="chip min-w-0 justify-start overflow-hidden bg-paper py-2 text-ink">
                <span className="rounded bg-[#15803d]/15 px-1 text-[10px] font-bold text-[var(--ok)]">POST</span>
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            Works in VS Code (Continue, Aider) and any OpenAI-compatible app.
          </p>
        </Reveal>

        <Reveal delay={80} className="min-w-0">
          <div className="overflow-hidden rounded-[22px] border border-black/20 bg-[var(--code-bg)] shadow-[0_40px_90px_-40px_rgba(139,92,246,0.6)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff4d8d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
              <div role="tablist" aria-label="Code language" className="ml-3 flex flex-wrap gap-1">
                {CODE.map((x) => (
                  <button
                    key={x.key}
                    role="tab"
                    aria-selected={lang === x.key}
                    onClick={() => setLang(x.key)}
                    className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
                      lang === x.key ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              <CopyButton text={c.code} className="ml-auto text-white/70 hover:bg-white/10 hover:text-white" />
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-[#f1e9dc] sm:p-5 sm:text-[13px]">
              <code>{c.code}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FAQ + final CTA ───────────────────────────────────────────────────── */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-line bg-bg-2/50">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
        <Head id="faq-title" eyebrow="FAQ" title="Good questions" />
        <div className="paper divide-y divide-line overflow-hidden">
          {API_FAQ.map((f) => (
            <details key={f.q}>
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left font-bold sm:px-6 sm:py-5">
                {f.q}
                <Plus size={18} className="chev shrink-0 text-soft transition-transform duration-200" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-muted sm:px-6">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section aria-label="Get your API key" className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-grad px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <div className="paper-grain pointer-events-none absolute inset-0 !opacity-20" aria-hidden="true" />
        <h2 className="relative text-4xl leading-tight text-balance sm:text-5xl">Get your API key now</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/90">
          Instant top-up from ₹150. Every top model, one balance, plus the free OTT24x7 AI app.
        </p>
        <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={buyUrl('api-key')} className="btn bg-white text-[#1f1b16] hover:-translate-y-px">
            <MessageCircle size={17} aria-hidden="true" /> Buy on WhatsApp
          </a>
          <a href="#pricing" className="btn border border-white/50 text-white hover:bg-white/10">
            See all plans
          </a>
        </div>
      </div>
    </section>
  );
}

