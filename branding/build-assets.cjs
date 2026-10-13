// Build store, web, and social assets from the selected brand artwork.
// Inputs: branding/mark.svg (transparent, square symbol) and
// docs/assets/wordmark.png (transparent, horizontal wordmark).
// Run with sharp available to Node: node branding/build-assets.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const output = (...parts) => path.join(root, ...parts);
const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(output(file)).toString('base64')}`;
const iconBackground = process.env.YOURCOLOR_ICON_BACKGROUND || '#F7F7FA';

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

function makeFeatureSvg() { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500" role="img" aria-label="yourcolor 픽셀 스트레치: 파란 꽃 사진의 편집 전후">
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#faf9fc"/><stop offset=".62" stop-color="#f2f3f8"/><stop offset="1" stop-color="#e4e9f7"/></linearGradient>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e0e5fb"/><stop offset="1" stop-color="#fce1d6"/></linearGradient>
  <clipPath id="beforeClip"><rect x="568" y="115" width="190" height="286" rx="18"/></clipPath>
  <clipPath id="afterClip"><rect x="751" y="47" width="230" height="376" rx="22"/></clipPath>
</defs>
<rect width="1024" height="500" fill="url(#paper)"/>
<circle cx="913" cy="36" r="215" fill="url(#accent)" opacity=".8"/>
<path d="M0 472H1024" stroke="#dfe1e9" stroke-width="2"/>
<image href="${dataUri('docs/assets/wordmark.png', 'image/png')}" x="65" y="62" width="350" height="72" preserveAspectRatio="xMinYMid meet"/>
<text x="68" y="202" font-family="Apple SD Gothic Neo,Arial Unicode MS,sans-serif" font-size="19" font-weight="700" fill="#6c559d" letter-spacing="3">PIXEL STRETCH</text>
<text x="65" y="278" font-family="Apple SD Gothic Neo,Arial Unicode MS,sans-serif" font-size="47" font-weight="800" fill="#20212a">사진의 색을</text>
<text x="65" y="338" font-family="Apple SD Gothic Neo,Arial Unicode MS,sans-serif" font-size="47" font-weight="800" fill="#20212a">길게 펼치다.</text>
<text x="68" y="389" font-family="Apple SD Gothic Neo,Arial Unicode MS,sans-serif" font-size="20" fill="#686b78">한 장의 사진이, 나만의 작품으로.</text>
<rect x="577" y="128" width="190" height="286" rx="18" fill="#31354a" opacity=".13"/>
<rect x="563" y="110" width="200" height="296" rx="24" fill="white"/>
<image href="${dataUri('docs/assets/electric-bloom.jpg', 'image/jpeg')}" x="568" y="115" width="190" height="286" preserveAspectRatio="xMidYMid slice" clip-path="url(#beforeClip)"/>
<rect x="763" y="61" width="230" height="376" rx="22" fill="#232847" opacity=".18"/>
<rect x="746" y="42" width="240" height="386" rx="27" fill="white"/>
<image href="${dataUri('docs/assets/electric-bloom-art.png', 'image/png')}" x="751" y="47" width="230" height="376" preserveAspectRatio="xMidYMid slice" clip-path="url(#afterClip)"/>
<rect x="588" y="361" width="151" height="31" rx="15.5" fill="#f9f9fb" opacity=".94"/>
<text x="664" y="382" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#424454" letter-spacing="2">ORIGINAL</text>
<rect x="772" y="381" width="189" height="31" rx="15.5" fill="#f9f9fb" opacity=".95"/>
<text x="866" y="402" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#424454" letter-spacing="2">YOURCOLOR</text>
</svg>`; }

async function main() {
  const markPath = requireInput('branding/mark.svg');
  requireInput('docs/assets/wordmark.png');
  if (!/^#[0-9a-fA-F]{6}$/.test(iconBackground)) {
    throw new Error('YOURCOLOR_ICON_BACKGROUND must be a six-digit hex color.');
  }
  const markSvg = fs.readFileSync(markPath, 'utf8');
  const metadata = await sharp(Buffer.from(markSvg)).metadata();
  if (metadata.width !== metadata.height) {
    throw new Error('branding/mark.svg must have a square viewport.');
  }
  const iconSvg = withBackground(markSvg);
  const featureSvg = makeFeatureSvg();
  fs.writeFileSync(output('android/release-assets/store-icon.svg'), iconSvg);
  fs.copyFileSync(markPath, output('docs/favicon.svg'));
  fs.writeFileSync(output('android/release-assets/feature-graphic.svg'), featureSvg);
  // Keep an opaque alpha channel for the 32-bit Play Store PNG.
  await sharp(Buffer.from(iconSvg)).resize(512, 512).flatten({ background: iconBackground })
    .ensureAlpha().png().toFile(output('android/release-assets/store-icon.png'));
  const feature = await sharp(Buffer.from(featureSvg)).png().flatten({ background: '#f7f7fa' }).toBuffer();
  fs.writeFileSync(output('android/release-assets/feature-graphic.png'), feature);
  fs.writeFileSync(output('docs/assets/og-image.png'), feature);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
