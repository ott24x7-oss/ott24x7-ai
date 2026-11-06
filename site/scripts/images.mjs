// Turns the real screenshots and logo into web-ready files.
//
//   screenshots/desktop/*.png  ->  public/shots/desktop/<name>-<w>.webp
//   screenshots/android/*.png  ->  public/shots/android/<name>-<w>.webp
//   brand/mark.svg + icon-512  ->  favicons, apple-touch-icon, og.png
//
// It also writes src/shots.json, which the page reads to know which
// screenshots exist and their sizes (so images never shift the layout).
// Run with `npm run images` after adding or replacing a screenshot.
// The output is committed, so the Railway build does not need sharp.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = path.join(root, 'public');
const WIDTHS = { desktop: [640, 1024, 1600], android: [240, 360, 480] };

async function pngs(dir) {
  try {
    return (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  } catch {
    return [];
  }
}

async function shots() {
  const manifest = {};
  for (const kind of ['desktop', 'android']) {
    const srcDir = path.join(root, 'screenshots', kind);
    const outDir = path.join(pub, 'shots', kind);
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });
    for (const file of await pngs(srcDir)) {
      const name = file.replace(/\.png$/i, '');
      const input = sharp(path.join(srcDir, file));
      const { width, height } = await input.metadata();
      const widths = [...new Set(WIDTHS[kind].map((w) => Math.min(w, width)))];
      const srcs = [];
      for (const w of widths) {
        const out = `${name}-${w}.webp`;
        await sharp(path.join(srcDir, file))
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 82, effort: 6 })
          .toFile(path.join(outDir, out));
        srcs.push({ w, url: `/shots/${kind}/${out}` });
      }
      manifest[`${kind}/${name}`] = { width, height, srcs };
      console.log(`  ${kind}/${name}  ${width}x${height}  -> ${widths.join(', ')}`);
    }
  }
  await fs.writeFile(path.join(root, 'src', 'shots.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function brand(manifest) {
  const mark = path.join(root, 'brand', 'mark.svg');
  await fs.copyFile(mark, path.join(pub, 'mark.svg'));
  await fs.copyFile(mark, path.join(pub, 'favicon.svg'));
  await fs.copyFile(path.join(root, 'brand', 'icon-512.png'), path.join(pub, 'icon-512.png'));
  await sharp(mark).resize(180, 180).png().toFile(path.join(pub, 'apple-touch-icon.png'));
  await sharp(mark).resize(192, 192).png().toFile(path.join(pub, 'icon-192.png'));
  await sharp(mark).resize(32, 32).png().toFile(path.join(pub, 'favicon-32.png'));

  // Open Graph poster, 1200x630: the logo, the headline and the real screenshots.
  const W = 1200, H = 630;
  const bg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="g" cx="0.2" cy="0.45" r="0.55">
          <stop offset="0" stop-color="#F41A1A" stop-opacity="0.38"/>
          <stop offset="1" stop-color="#050609" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="g2" cx="0.8" cy="0.45" r="0.55">
          <stop offset="0" stop-color="#38BDF8" stop-opacity="0.3"/>
          <stop offset="1" stop-color="#050609" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#FF7180"/><stop offset="1" stop-color="#F41A1A"/></linearGradient>
        <linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#818CF8"/></linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#050609"/>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect width="100%" height="100%" fill="url(#g2)"/>
      <g stroke="#FF4057" stroke-opacity="0.35" stroke-width="2" fill="none"><path d="M0 590 H220 L250 560 H420"/><path d="M0 40 H120 L150 70 H300"/></g>
      <text x="152" y="118" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#F7F7F9">OTT24x7 <tspan fill="url(#b)">AI</tspan></text>
      <text x="72" y="268" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="64" font-weight="800" fill="#F7F7F9" letter-spacing="-1.5">All your <tspan fill="url(#b)">AIs.</tspan></text>
      <text x="72" y="346" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="64" font-weight="800" fill="url(#t)" letter-spacing="-1.5">One screen.</text>
      <text x="72" y="420" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="26" fill="#9AA4B8">Ask once. Compare every answer.</text>
      <text x="72" y="456" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="26" fill="#9AA4B8">Combine them into one best answer.</text>
      <text x="72" y="560" font-size="20" fill="#F7F7F9" opacity="0.85" font-family="IBM Plex Mono, Consolas, monospace" letter-spacing="2">FREE · OPEN SOURCE · WINDOWS + ANDROID</text>
    </svg>`);
  const logo = await sharp(mark).resize(64, 64).png().toBuffer();
  const layers = [{ input: logo, left: 72, top: 70 }];

  const phoneSrc = path.join(root, 'screenshots', 'android', 'answers-dark.png');
  const deskSrc = path.join(root, 'screenshots', 'desktop', '01-compare-4-ai-answers.png');
  const hasDesk = Boolean(manifest['desktop/01-compare-4-ai-answers']);
  if (hasDesk) {
    const dw = 560, dh = 350;
    const desk = await sharp(deskSrc).resize(dw, dh, { fit: 'cover', position: 'top' })
      .composite([{ input: Buffer.from(`<svg width="${dw}" height="${dh}"><rect width="${dw}" height="${dh}" rx="14" fill="#fff"/></svg>`), blend: 'dest-in' }])
      .png().toBuffer();
    layers.push({ input: desk, left: 600, top: 120 });
  }
  const pw = 210, ph = 456;
  const phone = await sharp(phoneSrc).resize(pw, ph, { fit: 'cover', position: 'top' })
    .composite([{ input: Buffer.from(`<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="26" fill="#fff"/></svg>`), blend: 'dest-in' }])
    .png().toBuffer();
  const bezel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw + 16}" height="${ph + 16}"><rect width="${pw + 16}" height="${ph + 16}" rx="34" fill="#262D39"/></svg>`);
  const px = hasDesk ? 960 : 860, py = hasDesk ? 150 : 88;
  layers.push({ input: bezel, left: px - 8, top: py - 8 }, { input: phone, left: px, top: py });

  await sharp(bg).composite(layers).png({ compressionLevel: 9 }).toFile(path.join(pub, 'og.png'));
  console.log(`  og.png (${hasDesk ? 'desktop + phone' : 'phone only'})`);
}

console.log('Screenshots:');
const manifest = await shots();
console.log('Brand:');
await brand(manifest);
if (!manifest['desktop/01-compare-4-ai-answers']) {
  console.warn('\n! Desktop screenshots are missing. Add 01…07 PNGs to screenshots/desktop/ and run again.');
}
