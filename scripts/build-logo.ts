/**
 * Builds the brand files from the hand-built mark in lib/brand/logo.ts.
 *
 *   pnpm build:logo
 *
 * Output (committed):
 *   public/brand/logo-mark.svg         Azure → Emerald gradient, transparent
 *   public/brand/logo-mark-white.svg   single colour, for dark backgrounds
 *   public/brand/logo-mark-ink.svg     single colour (Midnight Ink), for light backgrounds
 *   public/brand/logo-mark*.png        the same three, 1024 px, transparent
 *   public/brand/favicon.svg           simplified mark on a Midnight Ink tile (16/32 px)
 *   public/brand/app-icon.svg|-512.png rounded-square app icon, 512 px
 *   app/icon.svg                       the favicon (Next.js serves it as <link rel="icon">)
 *   app/favicon.ico                    16, 32 and 48 px (PNG entries)
 *   app/apple-icon.png                 180 px
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { BRAND, logoSvg, SIMPLE } from "../lib/brand/logo";

const PUBLIC = "public/brand";
mkdirSync(PUBLIC, { recursive: true });

/** Tiles: the app icon (full mark) and the favicon (simplified, larger in its tile so it reads at 16 px). */
const APP_ICON = logoSvg({ tile: { fill: BRAND.ink, radius: 14.4 }, scale: 0.74 });
const FAVICON = logoSvg({ variant: SIMPLE, tile: { fill: BRAND.ink, radius: 14 }, scale: 0.86 });

const svgs: Record<string, string> = {
  [`${PUBLIC}/logo-mark.svg`]: logoSvg(),
  [`${PUBLIC}/logo-mark-white.svg`]: logoSvg({ paint: BRAND.white }),
  [`${PUBLIC}/logo-mark-ink.svg`]: logoSvg({ paint: BRAND.ink }),
  [`${PUBLIC}/favicon.svg`]: FAVICON,
  [`${PUBLIC}/app-icon.svg`]: APP_ICON,
  "app/icon.svg": FAVICON,
};

const png = (svg: string, size: number) => sharp(Buffer.from(svg), { density: Math.max(72, (72 * size) / 64) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** An .ico holding PNG images (supported by every current browser and Windows Vista+). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2); // no palette
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

async function main() {
  for (const [path, svg] of Object.entries(svgs)) writeFileSync(path, svg + "\n");
  const pngs: Record<string, Buffer> = {
    [`${PUBLIC}/logo-mark.png`]: await png(svgs[`${PUBLIC}/logo-mark.svg`]!, 1024),
    [`${PUBLIC}/logo-mark-white.png`]: await png(svgs[`${PUBLIC}/logo-mark-white.svg`]!, 1024),
    [`${PUBLIC}/logo-mark-ink.png`]: await png(svgs[`${PUBLIC}/logo-mark-ink.svg`]!, 1024),
    [`${PUBLIC}/app-icon-512.png`]: await png(APP_ICON, 512),
    "app/apple-icon.png": await png(APP_ICON, 180),
  };
  for (const [path, data] of Object.entries(pngs)) writeFileSync(path, data);
  const sizes = [16, 32, 48];
  writeFileSync("app/favicon.ico", ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(FAVICON, size) })))));
  console.log(`Wrote ${Object.keys(svgs).length} SVG, ${Object.keys(pngs).length} PNG and app/favicon.ico (${sizes.join(", ")} px)`);
}

void main();
