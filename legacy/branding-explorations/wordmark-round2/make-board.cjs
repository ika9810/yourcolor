// Review sheet: five text wordmarks paired with the user's selected twin-ribbon icon.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const here = __dirname;
const root = path.resolve(here, '../../..');
GlobalFonts.registerFromPath(path.join(root, 'docs/assets/WantedSansVariable.woff2'), 'Wanted');

const items = [
  { file: '01-strong.png', name: '01  단색 굵게', note: '묵직하고 가장 단순한 기본형' },
  { file: '02-two-tone.png', name: '02  두 색 조합', note: 'color만 코발트로 강조' },
  { file: '03-editorial.png', name: '03  에디토리얼', note: '여백과 자간을 살린 타이포' },
  { file: '04-motion.png', name: '04  모션', note: '앞으로 흐르는 듯한 기울기' },
  { file: '05-quiet.png', name: '05  가벼운 균형', note: '얇고 차분한 화면용 로고' },
];

async function main() {
  const canvas = createCanvas(1800, 1360);
  const c = canvas.getContext('2d');
  c.fillStyle = '#EEF1F7'; c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#1D2637'; c.font = '800 49px Wanted';
  c.fillText('yourcolor  ·  글씨 로고 5안', 70, 84);
  c.fillStyle = '#737E91'; c.font = '500 22px Wanted';
  c.fillText('선택하신 두 리본 아이콘과 함께 놓고 비교했습니다.', 73, 125);
  const icon = await loadImage(path.join(root, 'legacy/branding-explorations/icon-round2/01-twin-pull.png'));
  c.drawImage(icon, 1620, 34, 100, 100);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const y = 172 + i * 222;
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.roundRect(70, y, 1660, 198, 28); c.fill();
    c.drawImage(icon, 102, y + 31, 136, 136);

    const source = path.join(here, item.file);
    if (!fs.existsSync(source)) throw new Error(`Missing ${source}`);
    const trimmed = await sharp(source).trim().png().toBuffer();
    const wordmark = await loadImage(trimmed);
    const scale = Math.min(850 / wordmark.width, 127 / wordmark.height);
    const w = wordmark.width * scale;
    const h = wordmark.height * scale;
    c.drawImage(wordmark, 288, y + (198 - h) / 2, w, h);

    c.fillStyle = '#202B3E'; c.font = '800 29px Wanted';
    c.fillText(item.name, 1200, y + 88);
    c.fillStyle = '#828C9B'; c.font = '500 18px Wanted';
    c.fillText(item.note, 1200, y + 124);
  }

  c.fillStyle = '#8A94A4'; c.font = '500 17px Wanted';
  c.fillText('비교용 시안 · 현재 웹/Android/Play에는 아직 적용하지 않았습니다.', 72, 1326);
  fs.writeFileSync(path.join(here, 'compare.png'), canvas.toBuffer('image/png'));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
