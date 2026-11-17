import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// sitemap.xml and robots.txt are generated so they always use the real site URL
// (set VITE_SITE_URL in .env or in the Railway service variables).
function seoFiles(siteUrl: string): Plugin {
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: 'seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      });
    },
  };
}

// Preload the hero images so the browser fetches them before the JS runs (faster LCP).
// The sizes must match the ones in Hero.tsx so the same file is picked.
function heroPreload(base: string): Plugin {
  const b = base.replace(/\/$/, '');
  const HERO = [
    { key: 'desktop/01-compare-4-ai-answers', sizes: '(min-width: 1100px) 1000px, 92vw' },
    { key: 'android/answers-dark', sizes: '(min-width: 1100px) 230px, 30vw' },
  ];
  return {
    name: 'hero-preload',
    transformIndexHtml(_html, ctx) {
      const credit = ctx.filename.endsWith('buy-api-credit.html');
      // Preload the fonts used above the fold so the headline does not re-render late.
      const fontRe = credit
        ? /(newsreader-latin-400-normal|plus-jakarta-sans-latin-wght-normal)[^/]*\.woff2$/
        : /(space-grotesk-latin-700-normal|inter-latin-wght-normal)[^/]*\.woff2$/;
      const fonts = Object.keys(ctx.bundle ?? {})
        .filter((f) => fontRe.test(f))
        .map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${b}/${f}`, crossorigin: '' },
          injectTo: 'head' as const,
        }));
      const shots = JSON.parse(readFileSync(new URL('./src/shots.json', import.meta.url), 'utf8')) as Record<
        string,
        { srcs: { w: number; url: string }[] }
      >;
      if (credit) return fonts;
      return [...fonts, ...HERO.filter((h) => shots[h.key]).map((h) => ({
        tag: 'link',
        attrs: {
          rel: 'preload',
          as: 'image',
          type: 'image/webp',
          imagesrcset: shots[h.key].srcs.map((s) => `${b}${s.url} ${s.w}w`).join(', '),
          imagesizes: h.sizes,
          fetchpriority: 'high',
        },
        injectTo: 'head' as const,
      }))];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || 'https://ott24x7.com/ai').replace(/\/+$/, '');
  // Path the site is served under: "/ai/" inside the ott24x7.com shop, "/" on its own domain.
  const base = env.VITE_BASE || '/ai/';
  process.env.VITE_SITE_URL = siteUrl;
  // Site origin (scheme + host), used by pages that live outside /ai (e.g. /buy-api-credit).
  process.env.VITE_ORIGIN = new URL(siteUrl).origin;
  return {
    base,
    plugins: [react(), tailwindcss(), seoFiles(siteUrl), heroPreload(base)],
    build: {
      target: 'es2020',
      cssMinify: true,
      assetsInlineLimit: 2048,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          credit: fileURLToPath(new URL('./buy-api-credit.html', import.meta.url)),
        },
      },
    },
    preview: { allowedHosts: true },
  };
});
