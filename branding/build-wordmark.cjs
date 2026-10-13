// Render the same symbol and wordmark for the website and Android home screen.
// Requires sharp and @napi-rs/canvas; run before branding/build-assets.cjs.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '..');
const markFile = path.join(__dirname, 'mark.svg');
const fontFile = path.join(root, 'docs/assets/WantedSansVariable.woff2');
const targets = [
  path.join(root, 'docs/assets/wordmark.png'),
  path.join(root, 'android/app/src/main/res/drawable-nodpi/yourcolor_wordmark.png'),
];

async function main() {
  if (!GlobalFonts.registerFromPath(fontFile, 'Wanted')) throw new Error('Wanted Sans could not be loaded');
  const size = 2;
  const canvas = createCanvas(945 * size, 190 * size);
  const ctx = canvas.getContext('2d');
  ctx.scale(size, size);

  // The source has a generous launcher safe area. Crop it for the horizontal lockup.
  const symbol = await sharp(markFile).png().toBuffer();
  const image = await loadImage(symbol);
  ctx.drawImage(image, 96, 106, 320, 310, 18, 16, 164, 159);

  ctx.fillStyle = '#23232B';
  ctx.font = '800 160px Wanted';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('yourcolor', 207, 157);

  const png = canvas.toBuffer('image/png');
  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, png);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
