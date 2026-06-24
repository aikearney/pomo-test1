#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const rootDir = process.cwd();
const iconsDir = path.join(rootDir, 'public', 'icons');
const sourceImage = path.join(iconsDir, 'tomato.png');

const outputs = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generate() {
  const hasSource = await fileExists(sourceImage);

  if (!hasSource) {
    console.log('Icon generation skipped: missing source image at public/icons/tomato.png');
    console.log('Add a square PNG (recommended: 512x512+) and rerun: npm run generate:icons');
    process.exitCode = 0;
    return;
  }

  for (const output of outputs) {
    const outputPath = path.join(iconsDir, output.name);
    await sharp(sourceImage)
      .resize(output.size, output.size, {
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toFile(outputPath);
  }

  const icoBuffer = await pngToIco([
    path.join(iconsDir, 'favicon-16x16.png'),
    path.join(iconsDir, 'favicon-32x32.png'),
  ]);

  await fs.writeFile(path.join(iconsDir, 'favicon.ico'), icoBuffer);

  console.log('Generated icon assets in public/icons:');
  for (const output of outputs) {
    console.log(`- ${output.name}`);
  }
  console.log('- favicon.ico');
}

generate().catch((error) => {
  console.error('Failed to generate icons:', error);
  process.exit(1);
});
