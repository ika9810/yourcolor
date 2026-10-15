// A single, full-size review sheet for the three feature graphic concepts.
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '../../..');
GlobalFonts.registerFromPath(path.join(root, 'android/app/src/main/assets/fonts/WantedSansExtraBold.ttf'), 'WantedExtra');
GlobalFonts.registerFromPath(path.join(root, 'android/app/src/main/assets/fonts/Paperlogy-6SemiBold.ttf'), 'PaperSemi');

const items = [
  { file: 'option-a.png', label: '01  전후 비교', note: '원본과 결과가 한눈에 보이는 구성' },
  { file: 'option-b.png', label: '02  작품 중심', note: '완성된 이미지의 힘을 앞세운 구성' },
  { file: 'option-c.png', label: '03  에디터 중심', note: '앱의 조절 경험을 보여주는 구성' },
];

async function main() {
  const canvas = createCanvas(1096, 1810);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F0F3F9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#20232B';
  ctx.font = '700 32px WantedExtra';
  ctx.fillText('yourcolor  대표 이미지 3안', 36, 57);
  ctx.fillStyle = '#697487';
  ctx.font = '600 16px PaperSemi';
  ctx.fillText('확정 로고 적용 · 하단 장식선 제거 · 1024 × 500', 37, 84);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const top = 112 + i * 558;
    ctx.fillStyle = '#20232B';
    ctx.font = '700 22px WantedExtra';
    ctx.fillText(item.label, 36, top + 22);
    ctx.fillStyle = '#7B8594';
    ctx.font = '600 15px PaperSemi';
    ctx.fillText(item.note, 249, top + 21);
    const image = await loadImage(path.join(__dirname, item.file));
    ctx.drawImage(image, 36, top + 39, 1024, 500);
  }
  const output = path.join(__dirname, 'compare.png');
  fs.writeFileSync(output, canvas.toBuffer('image/png'));
  process.stdout.write(`${output}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
