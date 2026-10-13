// Build Android launcher resources from the same mark as the Play store icon.
// Run from the repository root with sharp available to Node:
//   node android/tools/build_launcher_icons.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const res = path.join(root, 'android/app/src/main/res');
const storeIcon = path.join(root, 'android/release-assets/store-icon.png');
const mark = path.join(root, 'branding/mark.svg');

async function main() {
  if (!fs.existsSync(storeIcon) || !fs.existsSync(mark)) {
    throw new Error('Build branding/mark.svg and the store icon first: node branding/build-assets.cjs');
  }
  for (const [density, size] of Object.entries({
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
  })) {
    const directory = path.join(res, `mipmap-${density}`);
    fs.mkdirSync(directory, { recursive: true });
    await sharp(storeIcon).resize(size, size, { fit: 'fill' }).png().toFile(path.join(directory, 'ic_launcher.png'));
  }

  // Adaptive icons use a full blue background and transparent ribbons.
  // Removing the mark's single rounded-square background keeps the ribbons
  // inside the launcher mask and avoids a small square inside a larger circle.
  const markSvg = fs.readFileSync(mark, 'utf8');
  const roundedSquares = markSvg.match(/<rect\b[^>]*\/>/g) || [];
  if (roundedSquares.length !== 1) {
    throw new Error('Expected one rounded-square background in branding/mark.svg');
  }
  const foregroundSvg = markSvg.replace(roundedSquares[0], '');
  const ribbons = await sharp(Buffer.from(foregroundSvg)).resize(480, 480).png().toBuffer();
  const foreground = await sharp(ribbons).extend({
    top: 16,
    bottom: 16,
    left: 16,
    right: 16,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).ensureAlpha().png().toBuffer();
  const directory = path.join(res, 'drawable-nodpi');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'ic_launcher_foreground.png'), foreground);

  const { data, info } = await sharp(foreground).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  await sharp(data, { raw: info }).png().toFile(path.join(directory, 'ic_launcher_monochrome.png'));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
