// Rebuild the square brand mark and social / Play feature graphic.
// Run with sharp available to Node: node branding/build-assets.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const output = (...parts) => path.join(root, ...parts);
const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(output(file)).toString('base64')}`;

const gradient = `<linearGradient id="brand" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6631b5"/><stop offset=".06" stop-color="#e6a0ba"/>
  <stop offset=".12" stop-color="#803994"/><stop offset=".18" stop-color="#ef6d40"/>
  <stop offset=".25" stop-color="#e49b4a"/><stop offset=".34" stop-color="#37243f"/>
  <stop offset=".52" stop-color="#e86030"/><stop offset=".65" stop-color="#f6b273"/>
  <stop offset=".76" stop-color="#70356d"/><stop offset=".82" stop-color="#ef502f"/>
  <stop offset=".88" stop-color="#ec9873"/><stop offset=".94" stop-color="#b22f67"/>
  <stop offset="1" stop-color="#65339a"/>
</linearGradient>`;

// The long horizontal o comes from the approved wordmark. Keep the center
// transparent so the same symbol works on the Android adaptive foreground.
const symbol = `<defs>${gradient}<mask id="ring"><rect x="69" y="165" width="374" height="182" rx="91" fill="white"/><rect x="146" y="224" width="220" height="64" rx="32" fill="black"/></mask></defs>
<rect x="69" y="165" width="374" height="182" rx="91" fill="url(#brand)" mask="url(#ring)"/>`;

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="yourcolor 컬러 o 심볼">${symbol}</svg>`;
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="yourcolor 앱 아이콘">
<rect width="512" height="512" fill="#f7f7fa"/>${symbol}</svg>`;
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="yourcolor"><rect width="64" height="64" rx="17" fill="#f7f7fa"/><g transform="translate(0 0) scale(.125)">${symbol}</g></svg>`;

const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500" role="img" aria-label="yourcolor 픽셀 스트레치: 파란 꽃 사진의 편집 전후">
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#faf9fc"/><stop offset=".62" stop-color="#f2f3f8"/><stop offset="1" stop-color="#e4e9f7"/></linearGradient>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e0e5fb"/><stop offset="1" stop-color="#fce1d6"/></linearGradient>
  <clipPath id="beforeClip"><rect x="568" y="115" width="190" height="286" rx="18"/></clipPath>
  <clipPath id="afterClip"><rect x="751" y="47" width="230" height="376" rx="22"/></clipPath>
</defs>
<rect width="1024" height="500" fill="url(#paper)"/>
<circle cx="913" cy="36" r="215" fill="url(#accent)" opacity=".8"/>
<path d="M0 472H1024" stroke="#dfe1e9" stroke-width="2"/>
<image href="${dataUri('docs/assets/wordmark.png', 'image/png')}" x="65" y="58" width="365" height="77"/>
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
</svg>`;

async function main() {
  fs.writeFileSync(output('branding/o-mark.svg'), markSvg);
  fs.writeFileSync(output('android/release-assets/store-icon.svg'), iconSvg);
  fs.writeFileSync(output('docs/favicon.svg'), faviconSvg);
  fs.writeFileSync(output('android/release-assets/feature-graphic.svg'), featureSvg);
  // Play requires a 32-bit PNG. The background is drawn inside the SVG, so
  // retaining an opaque alpha channel changes no visible pixels.
  await sharp(Buffer.from(iconSvg)).png().toFile(output('android/release-assets/store-icon.png'));
  const feature = await sharp(Buffer.from(featureSvg)).png().flatten({ background: '#f7f7fa' }).toBuffer();
  fs.writeFileSync(output('android/release-assets/feature-graphic.png'), feature);
  fs.writeFileSync(output('docs/assets/og-image.png'), feature);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
