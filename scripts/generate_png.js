import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const svgPath = 'e:/Coding/PianoFlow/public/favicon.svg';
const outPathResvg = 'e:/Coding/PianoFlow/public/icon_resvg.png';
const outPathSharp = 'e:/Coding/PianoFlow/public/icon_sharp.png';
const outPath1024 = 'e:/Coding/PianoFlow/public/app-icon-1024.png';

const svgContent = fs.readFileSync(svgPath);

// Render using Resvg
try {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 1024,
    },
  });
  const pngData = resvg.render().asPng();
  fs.writeFileSync(outPathResvg, pngData);
  console.log('Resvg render successful:', outPathResvg);
} catch (e) {
  console.error('Resvg render failed:', e);
}

// Render using Sharp
try {
  await sharp(svgPath)
    .resize(1024, 1024)
    .png()
    .toFile(outPathSharp);
  console.log('Sharp render successful:', outPathSharp);
} catch (e) {
  console.error('Sharp render failed:', e);
}

// Prefer resvg if available as resvg handles SVG filters well, or sharp
if (fs.existsSync(outPathResvg)) {
  fs.copyFileSync(outPathResvg, outPath1024);
  console.log('Copied Resvg output to', outPath1024);
} else if (fs.existsSync(outPathSharp)) {
  fs.copyFileSync(outPathSharp, outPath1024);
  console.log('Copied Sharp output to', outPath1024);
}
