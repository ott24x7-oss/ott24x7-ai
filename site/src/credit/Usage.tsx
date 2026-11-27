import { useMemo, useState } from 'react';
import { Calculator, Film, Image as ImageIcon, MessageSquareText, Search } from 'lucide-react';
import { Reveal } from '../components/ui';
import { IMAGE_RATES, TEXT_RATES, TYPICAL, VIDEO_RATES, compact, money, type MediaRate, type TextRate } from './rates';

const CREDITS = [20, 40, 100, 200, 400, 1000];

type Option =
  | { key: string; label: string; group: string; kind: 'text'; rate: TextRate }
  | { key: string; label: string; group: string; kind: 'image' | 'video'; rate: MediaRate };

function buildOptions(): Option[] {
  const out: Option[] = [];
  for (const f of TEXT_RATES)
    for (const r of f.rates) out.push({ key: `t:${r.model}`, label: r.model, group: f.family, kind: 'text', rate: r });
  for (const r of IMAGE_RATES) out.push({ key: `i:${r.model}`, label: r.model, group: 'Image', kind: 'image', rate: r });
  VIDEO_RATES.forEach((r, i) =>
    out.push({ key: `v:${i}`, label: `${r.model}${r.note ? ` (${r.note})` : ''}`, group: 'Video', kind: 'video', rate: r }),
  );
  return out;
}

function Explainers() {
  const items = [
    {
      icon: MessageSquareText,
      title: 'Text & code',
      text: 'Charged per 1M tokens. Input is what you send, output is what the AI writes, cached input is repeated context (much cheaper).',
      hint: '1M tokens ≈ 750,000 words',
    },
    { icon: ImageIcon, title: 'Images', text: 'A flat amount for each image you create or edit.', hint: 'from $0.20 per image' },
    { icon: Film, title: 'Video', text: 'Charged per second of video. Higher resolution costs more per second.', hint: 'from $0.20 per second' },
  ];
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {items.map((it, i) => (
        <Reveal as="li" key={it.title} delay={i * 70} className="paper p-5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-grad text-white shadow-[0_12px_28px_-14px_#ff4d8d]">
            <it.icon size={20} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-2xl leading-none">{it.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{it.text}</p>
          <p className="mt-3 font-mono text-xs text-terra">{it.hint}</p>
        </Reveal>
      ))}
    </ul>
  );
}

function CreditCalculator() {
  const options = useMemo(buildOptions, []);
  const [credit, setCredit] = useState(40);
  const [key, setKey] = useState('t:claude-sonnet-5-5');
  const o = options.find((x) => x.key === key) ?? options[0];
  const groups = [...new Set(options.map((x) => x.group))];

  let big = '';
  let bigLabel = '';
  const lines: string[] = [];
  if (o.kind === 'text') {
    const r = o.rate;
    const perMsg = (TYPICAL.input * r.input + TYPICAL.output * r.output) / 1e6;
    big = compact(credit / perMsg);
    bigLabel = 'chat messages';
    lines.push(`or ${compact((credit / r.input) * 1e6)} input tokens`);
    lines.push(`or ${compact((credit / r.output) * 1e6)} output tokens`);
    lines.push(`≈ ${money(perMsg)} per message`);
  } else if (o.kind === 'image') {
    big = compact(credit / o.rate.price);
    bigLabel = 'images';
    lines.push(`${money(o.rate.price)} per image`);
  } else {
    const secs = credit / o.rate.price;
    big = compact(secs);
    bigLabel = 'seconds of video';
    lines.push(`${money(o.rate.price)} per second`);
    if (secs >= 10) lines.push(`about ${compact(secs / 10)} clips of 10 s`);
  }

  return (
    <Reveal className="relative mt-10 overflow-hidden rounded-[26px] border border-line bg-paper p-5 shadow-[var(--shadow)] sm:p-8">
      <div className="blobs !opacity-40" aria-hidden="true" />
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="eyebrow mb-3">
            <Calculator size={14} aria-hidden="true" /> Credit calculator
          </p>
          <h3 className="text-3xl leading-tight sm:text-4xl">How far does your credit go?</h3>

          <p className="mt-6 text-sm font-bold" id="credit-label">
            Your credit
          </p>
          <div role="radiogroup" aria-labelledby="credit-label" className="mt-2 flex flex-wrap gap-2">
            {CREDITS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={credit === c}
                onClick={() => setCredit(c)}
                className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors duration-150 ${
                  credit === c ? 'bg-ink text-bg' : 'border border-line-2 bg-paper text-muted hover:text-ink'
                }`}
              >
                ${c.toLocaleString('en-US')}
              </button>
            ))}
          </div>

          <label htmlFor="calc-model" className="mt-5 block text-sm font-bold">
            Model
          </label>
          <select
            id="calc-model"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line-2 bg-paper px-3 py-3 font-mono text-sm text-ink"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {options
                  .filter((x) => x.group === g)
                  .map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="rounded-[22px] bg-[var(--code-bg)] p-6 text-center text-white sm:p-8" aria-live="polite">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/60">
            ${credit.toLocaleString('en-US')} credit on {o.kind === 'video' ? o.rate.model : o.label}
          </p>
          <p className="mt-3 font-serif text-6xl leading-none sm:text-7xl">
            <span className="text-grad">≈ {big}</span>
          </p>
          <p className="mt-2 text-lg font-bold">{bigLabel}</p>
          <ul className="mt-4 space-y-1 text-sm text-white/70">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="relative mt-5 text-xs text-soft">
        Estimates. A chat message here is about {TYPICAL.input.toLocaleString('en-US')} tokens in and{' '}
        {TYPICAL.output} tokens out. Real usage depends on the length of your prompts and answers.
      </p>
    </Reveal>
  );
}

function RateTable() {
  const tabs = [...TEXT_RATES.map((f) => ({ key: f.family, label: f.family, icon: f.icon })), { key: 'Image', label: 'Images', icon: '🖼️' }, { key: 'Video', label: 'Video', icon: '🎬' }];
  const [tab, setTab] = useState(tabs[0].key);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const text = TEXT_RATES.find((f) => f.family === tab);
  const media = tab === 'Image' ? IMAGE_RATES : tab === 'Video' ? VIDEO_RATES : null;

  const textRows = (text?.rates ?? []).filter((r) => !needle || r.model.includes(needle));
  const mediaRows = (media ?? []).filter((r) => !needle || r.model.includes(needle));

  return (
    <Reveal className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Model family" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls="rate-panel"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors duration-150 ${
                tab === t.key ? 'bg-ink text-bg' : 'border border-line bg-paper text-muted hover:text-ink'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Search models</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-soft" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search model…"
            className="w-full rounded-xl border border-line-2 bg-paper py-2.5 pl-9 pr-3 font-mono text-sm text-ink placeholder:text-soft"
          />
        </label>
      </div>

      <div id="rate-panel" role="tabpanel" aria-label={`${tab} rates`} className="paper mt-4 overflow-hidden">
        {text && (
          <>
            <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 border-b border-line bg-bg-2/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-soft md:grid">
              <span>Model</span>
              <span className="text-right">Input</span>
              <span className="text-right">Cached input</span>
              <span className="text-right">Output</span>
            </div>
            <ul className="divide-y divide-line">
              {textRows.map((r) => (
                <li key={r.model} className="grid grid-cols-3 gap-x-3 gap-y-2 px-5 py-3.5 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:items-center">
                  <span className="col-span-3 flex flex-wrap items-center gap-2 md:col-span-1">
                    <span className="font-mono text-sm font-medium">{r.model}</span>
                    {r.tag && <span className="rounded-md bg-chip px-1.5 py-0.5 text-[10px] font-bold text-soft">{r.tag}</span>}
                  </span>
                  {(
                    [
                      ['Input', r.input],
                      ['Cached', r.cached],
                      ['Output', r.output],
                    ] as const
                  ).map(([label, v]) => (
                    <span key={label} className="md:text-right">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-soft md:hidden">{label}</span>
                      <span className="font-mono text-sm font-semibold">{money(v)}</span>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <p className="border-t border-line bg-bg-2/40 px-5 py-3 text-xs text-soft">
              Credit charged per 1M tokens. Works on /v1/chat/completions and /v1/messages.
            </p>
          </>
        )}
        {media && (
          <>
            <ul className="divide-y divide-line">
              {mediaRows.map((r, i) => (
                <li key={`${r.model}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{r.model}</span>
                    {r.note && <span className="rounded-md bg-chip px-1.5 py-0.5 text-[10px] font-bold text-soft">{r.note}</span>}
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {money(r.price)} <span className="font-normal text-soft">/ {r.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line bg-bg-2/40 px-5 py-3 text-xs text-soft">
              Credit charged per {tab === 'Image' ? 'image' : 'second of video'}.{' '}
              {tab === 'Image' ? 'Works on /v1/images/generations.' : 'Works on /v1/videos.'}
            </p>
          </>
        )}
        {((text && textRows.length === 0) || (media && mediaRows.length === 0)) && (
          <p className="px-5 py-8 text-center text-sm text-soft">No model matches “{q}” in {tab}.</p>
        )}
      </div>
    </Reveal>
  );
}

export function Usage() {
  return (
    <section id="usage" aria-labelledby="usage-title" className="border-t border-line bg-bg-2/50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <p className="eyebrow mb-4">Credit usage</p>
          <h2 id="usage-title" className="text-4xl leading-[1.05] text-balance sm:text-5xl">
            Where your <em className="text-grad">credit</em> goes
          </h2>
          <p className="mt-4 text-base text-pretty text-muted sm:text-lg">
            You only pay for what you use. Here is exactly what each model takes from your credit.
          </p>
        </Reveal>
        <Explainers />
        <CreditCalculator />
        <RateTable />
      </div>
    </section>
  );
}
