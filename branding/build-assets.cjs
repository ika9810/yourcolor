// Build store, web, and social assets from the selected brand artwork.
// Inputs: branding/mark.svg (transparent, square symbol) and
// branding/wordmark.png (transparent, approved text logo).
// Run with sharp available to Node: node branding/build-assets.cjs
// Use --icon-only to refresh just the icon and favicon.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const output = (...parts) => path.join(root, ...parts);
const iconBackground = process.env.YOURCOLOR_ICON_BACKGROUND || '#F7F8FB';
const iconOnly = process.argv.includes('--icon-only');

function requireInput(file) {
  const fullPath = output(file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing ${file}. Add the selected brand asset before rebuilding.`);
  }
  return fullPath;
}

function withBackground(markSvg) {
  const opening = /<svg\b[^>]*>/i.exec(markSvg);
  if (!opening) throw new Error('branding/mark.svg must contain an SVG root element.');
  const position = opening.index + opening[0].length;
  return `${markSvg.slice(0, position)}<rect x="0" y="0" width="100%" height="100%" fill="${iconBackground}"/>${markSvg.slice(position)}`;
}

function makeFeatureSvg(png) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500" role="img" aria-label="yourcolor - 나만의 pixel stretch. 너의 순간을, 조금 더 길게. 사진 속 색을 펼쳐 만드는 나만의 픽셀 스트레치."><title>yourcolor 대표 이미지</title><image href="data:image/png;base64,${png.toString('base64')}" width="1024" height="500"/></svg>`;
}

async function main() {
  const markPath = requireInput('branding/mark.svg');
  if (!iconOnly) requireInput('branding/wordmark.png');
  if (!/^#[0-9a-fA-F]{6}$/.test(iconBackground)) {
    throw new Error('YOURCOLOR_ICON_BACKGROUND must be a six-digit hex color.');
  }
  const markSvg = fs.readFileSync(markPath, 'utf8');
  const metadata = await sharp(Buffer.from(markSvg)).metadata();
  if (metadata.width !== metadata.height) {
    throw new Error('branding/mark.svg must have a square viewport.');
  }
  const iconSvg = withBackground(markSvg);
  fs.writeFileSync(output('android/release-assets/store-icon.svg'), iconSvg);
  fs.copyFileSync(markPath, output('docs/favicon.svg'));
  // Keep an opaque alpha channel for the 32-bit Play Store PNG.
  await sharp(Buffer.from(iconSvg)).resize(512, 512).flatten({ background: iconBackground })
    .ensureAlpha().png().toFile(output('android/release-assets/store-icon.png'));
  if (!iconOnly) {
    const renderFeatureGraphic = require('./build-feature-graphic.cjs');
    const feature = await sharp(await renderFeatureGraphic()).flatten({ background: '#fff' }).png().toBuffer();
    fs.writeFileSync(output('android/release-assets/feature-graphic.png'), feature);
    fs.writeFileSync(output('docs/assets/og-image.png'), feature);
    fs.writeFileSync(output('android/release-assets/feature-graphic.svg'), makeFeatureSvg(feature));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
