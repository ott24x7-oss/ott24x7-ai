# OTT24x7 AI — landing page

The website for [OTT24x7 AI](https://github.com/ott24x7-oss/ott24x7-ai), built as a static site with React, Vite, TypeScript and Tailwind CSS. It has no backend.

```bash
cd site
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
npm run preview    # serve dist/ locally
```

## Design

The look matches [ott24x7.com](https://ott24x7.com): near-black `#050609` base, the red primary button
(`#F75454 → #F41A1A → #CD1616`), red `#FF7180 → #FF4057` and blue `#38BDF8 → #818CF8` gradient words,
Space Grotesk headings, Inter body text and IBM Plex Mono labels. All colours are CSS tokens at the top of
`src/index.css`, with a light theme under `[data-theme='light']`.

## Folder layout

| Path | What it is |
|---|---|
| `src/content.ts` | All copy, links, FAQ, guide steps and screenshot alt texts. Edit text here. |
| `src/components/` | Page sections (Header, Hero, Sections, Guide, Gallery, Bottom) and shared UI. |
| `screenshots/desktop/` | Original Windows screenshots `01-….png` to `07-….png`. |
| `screenshots/android/` | Original Android screenshots (`answers-dark.png`, `model-picker.png`, …). |
| `brand/` | `mark.svg` and `icon-512.png`. |
| `public/` | Generated WebP screenshots, favicons and `og.png`. Committed, so the build does not need sharp. |
| `scripts/images.mjs` | Makes the WebP files, icons, `og.png` and `src/shots.json` from the originals. |

## Adding or replacing screenshots

1. Put the PNG in `screenshots/desktop/` or `screenshots/android/`. Desktop files are matched by their number, so `02-anything.png` is used wherever screenshot 02 belongs.
2. Run `npm run images`. This rebuilds `public/shots/`, `public/og.png` and `src/shots.json`.
3. Commit the PNG and the generated files.

A section whose screenshot is missing still renders, just without the image. No placeholder UI is shown.

## Site URL

The public URL is set by `VITE_SITE_URL` (default: `https://ott24x7.com/ai`), and the path the site is served under by `VITE_BASE` (default `/ai/`; the Dockerfile uses `/`). It is used for the canonical link, Open Graph, JSON-LD, `sitemap.xml` and `robots.txt`, which are generated at build time.

## Live at ott24x7.com/ai

The page is served by the OTT24x7 shop (Flask app in the `railway_final` repo) at
**https://ott24x7.com/ai**. The build uses `VITE_BASE=/ai/`, so every file URL starts with `/ai/`.

To update it:

```bash
cd site
npm run build
# copy the build into the shop (robots.txt and sitemap.xml are left out; the shop has its own)
rm -rf "<railway_final>/web/ai_site" && cp -r dist "<railway_final>/web/ai_site"
rm "<railway_final>/web/ai_site/robots.txt" "<railway_final>/web/ai_site/sitemap.xml"
```

Then commit `web/ai_site/` in the shop repo and push. The shop routes are `ai_landing*` in `public_site.py`.

## Deploy on Railway (standalone, optional)

This folder has a `Dockerfile` (Node builds the site, nginx serves `dist/` on `$PORT` with gzip and cache headers) and a `railway.json`.

1. In Railway, **New Project → Deploy from GitHub repo → `ott24x7-oss/ott24x7-ai`**.
2. Open the service **Settings**:
   - **Root Directory:** `/site`
   - **Config file path:** `/site/railway.json`. This makes Railway use the Dockerfile and only redeploy when files under `site/` change.
3. **Variables** (optional): `VITE_SITE_URL=https://ai.ott24x7.com`, if the URL differs from `.env`. Railway passes it to the Docker build automatically. `PORT` is set by Railway.
4. Deploy. Railway gives you a `*.up.railway.app` URL. Open it to check.
5. **Custom domain:** in **Settings → Networking → Custom Domain**, add `ai.ott24x7.com`. Railway shows a CNAME target. Add it at your DNS provider:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `ai` | *the target Railway shows* |

   If you use Cloudflare, set the record to **DNS only** (grey cloud) until Railway shows the certificate as issued. HTTPS is automatic.

### Without Docker

Railway can also build with Nixpacks/Railpack. Delete or rename `railway.json` and `Dockerfile`. Railway then runs `npm install`, `npm run build` and `npm start`, which is `vite preview --host 0.0.0.0 --port $PORT`. The Docker + nginx setup is faster and caches better, so use it if you can.

## Checks

- `npm run build` must pass (TypeScript plus the Vite build).
- Lighthouse (local, Nov 2026, all screenshots, ott24x7 theme): mobile 96 / 100 / 100 / 100, desktop 100 / 100 / 100 / 100 (Performance / Accessibility / Best Practices / SEO).

## License

AGPL-3.0, same as the app.
