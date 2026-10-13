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

  // Fit the visible symbol, rather than its canvas, inside the 66 dp safe zone
  // of Android's 108 dp adaptive icon. This works for any transparent mark.
  const { data: fitted, info: fittedInfo } = await sharp(mark).trim().resize(312, 312, {
    fit: 'inside',
  }).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const left = Math.floor((512 - fittedInfo.width) / 2);
  const top = Math.floor((512 - fittedInfo.height) / 2);
  const foreground = await sharp(fitted).extend({
    top,
    bottom: 512 - fittedInfo.height - top,
    left,
    right: 512 - fittedInfo.width - left,
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
