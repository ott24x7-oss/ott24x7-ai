import { Download, Smartphone } from 'lucide-react';
import { LINKS } from '../content';
import { getShot } from '../shots';
import { Circuit } from './Circuit';
import { BrowserFrame, PhoneFrame } from './ui';

export function Hero() {
  const hasDesktop = Boolean(getShot('desktop/01-compare-4-ai-answers'));

  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="hero-glow" aria-hidden="true" />
      <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
      <Circuit />
      <div className="noise pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="pill mb-7">
            <span className="live-dot" aria-hidden="true" />
            One prompt · Many AIs · One best answer
          </p>
          <h1
            id="hero-title"
            className="text-[2.75rem] font-bold leading-[1.02] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[5.25rem]"
          >
            All your <span className="text-grad-blue">AIs.</span>
            <br />
            <span className="text-grad-red">One screen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg">
            Ask once — ChatGPT, Claude, Gemini, DeepSeek and your own API models answer side by side. Combine them
            into one best answer.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <a href={LINKS.windows} className="btn btn-primary h-12 px-6 text-base">
              <Download size={18} aria-hidden="true" />
              Download for Windows
            </a>
            <a href={LINKS.android} className="btn btn-secondary h-12 px-6 text-base">
              <Smartphone size={18} aria-hidden="true" />
              Download Android APK
            </a>
          </div>
          <p className="mt-5 font-mono text-xs tracking-wide text-muted">
            Free <span className="text-red-text">·</span> Open source (AGPL) <span className="text-blue-text">·</span> No
            sign-up
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
          <BrowserFrame
            id="desktop/01-compare-4-ai-answers"
            laptop
            eager
            sizes="(min-width: 1100px) 1000px, 92vw"
            className="pr-[10%] sm:pr-[12%]"
            placeholderClass="pr-[24%] sm:pr-[14%]"
          />
          <PhoneFrame
            id="android/answers-dark"
            eager
            sizes="(min-width: 1100px) 230px, 30vw"
            className={`absolute right-0 max-w-[230px] ${hasDesktop ? '-bottom-6 w-[26%] sm:-bottom-10' : '-bottom-8 w-[32%] sm:-bottom-12 sm:w-[26%]'}`}
          />
        </div>
      </div>
    </section>
  );
}
