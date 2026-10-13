// Combine the approved twin-ribbon mark with approved wordmark option 01.
// Output stays at 2x resolution for the website and Android home screen.
// Run before branding/build-assets.cjs.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const markFile = path.join(__dirname, 'mark.svg');
const wordmarkFile = path.join(__dirname, 'wordmark.png');
const targets = [
  path.join(root, 'docs/assets/wordmark.png'),
  path.join(root, 'android/app/src/main/res/drawable-nodpi/yourcolor_wordmark.png'),
];

async function main() {
  for (const file of [markFile, wordmarkFile]) {
    if (!fs.existsSync(file)) throw new Error(`Missing approved brand asset: ${file}`);
  }

  // The visible blue square and lettering have matching height and baseline.
  const symbol = await sharp(markFile).resize(326, 326).png().toBuffer();
  const lettering = await sharp(wordmarkFile).resize({ width: 1500 }).png().toBuffer();
  const png = await sharp({
    create: { width: 1890, height: 380, channels: 4, background: '#00000000' },
  }).composite([
    { input: symbol, left: 28, top: 27 },
    { input: lettering, left: 360, top: 27 },
  ]).png().toBuffer();

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, png);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
