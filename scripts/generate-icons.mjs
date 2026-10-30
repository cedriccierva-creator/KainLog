// Generates PWA/app icons from inline SVG. Run `npm run icons` after changing
// the artwork; the PNGs in public/icons are committed so builds need no sharp.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ART = `
  <g fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.9">
    <path d="M196 132c-16 22 16 40 0 62"/>
    <path d="M256 116c-16 22 16 40 0 62"/>
    <path d="M316 132c-16 22 16 40 0 62"/>
  </g>
  <path d="M150 300h212c0 62-47 108-106 108s-106-46-106-108z" fill="#ffffff"/>
  <path d="M150 300c0-58 47-92 106-92s106 34 106 92z" fill="#d1fae5"/>
  <path d="M150 300h212" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
`;

const gradient = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#047857"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
`;

/** Rounded-square icon used by the manifest and iOS home screen. */
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${gradient}
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  ${ART}
</svg>`;

/**
 * Maskable icons may be cropped to a circle by Android, so the artwork sits
 * inside the safe zone (72% of the canvas) on a full-bleed background.
 */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${gradient}
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
    ${ART}
  </g>
</svg>`;

await mkdir('public/icons', { recursive: true });

const outputs = [
  { svg: rounded, size: 192, file: 'public/icons/icon-192.png' },
  { svg: rounded, size: 512, file: 'public/icons/icon-512.png' },
  { svg: maskable, size: 512, file: 'public/icons/icon-maskable-512.png' },
  { svg: rounded, size: 180, file: 'public/icons/apple-touch-icon-180.png' },
];

for (const { svg, size, file } of outputs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(`${file} (${size}×${size})`);
}

// Scalable favicon for the browser tab.
await writeFile('public/favicon.svg', rounded);
console.log('public/favicon.svg');
