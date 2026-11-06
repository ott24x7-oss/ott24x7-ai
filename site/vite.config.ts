import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
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
function heroPreload(): Plugin {
  const HERO = [
    { key: 'desktop/01-compare-4-ai-answers', sizes: '(min-width: 1100px) 1000px, 92vw' },
    { key: 'android/answers-dark', sizes: '(min-width: 1100px) 230px, 30vw' },
  ];
  return {
    name: 'hero-preload',
    transformIndexHtml(_html, ctx) {
      // Preload the fonts used above the fold so the headline does not re-render late.
      const fonts = Object.keys(ctx.bundle ?? {})
        .filter((f) => /(space-grotesk-latin-700-normal|inter-latin-wght-normal)[^/]*\.woff2$/.test(f))
        .map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' },
          injectTo: 'head' as const,
        }));
      const shots = JSON.parse(readFileSync(new URL('./src/shots.json', import.meta.url), 'utf8')) as Record<
        string,
        { srcs: { w: number; url: string }[] }
      >;
      return [...fonts, ...HERO.filter((h) => shots[h.key]).map((h) => ({
        tag: 'link',
        attrs: {
          rel: 'preload',
          as: 'image',
          type: 'image/webp',
          imagesrcset: shots[h.key].srcs.map((s) => `${s.url} ${s.w}w`).join(', '),
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
  const siteUrl = (env.VITE_SITE_URL || 'https://ai.ott24x7.com').replace(/\/+$/, '');
  process.env.VITE_SITE_URL = siteUrl;
  return {
    plugins: [react(), tailwindcss(), seoFiles(siteUrl), heroPreload()],
    build: { target: 'es2020', cssMinify: true, assetsInlineLimit: 2048 },
    preview: { allowedHosts: true },
  };
});
