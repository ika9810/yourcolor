// Review-only contact sheet for five app icon directions. Does not touch shipped assets.
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const here = __dirname;
const root = path.resolve(here, '../../..');
GlobalFonts.registerFromPath(path.join(root, 'docs/assets/WantedSansVariable.woff2'), 'Wanted');

const options = [
  { file: '01-twin-pull.png', label: '01  트윈 리본', note: '처음 아이콘의 두 곡선을 더 선명하게' },
  { file: '02-photo-peel.png', label: '02  사진 모서리', note: '사진의 한쪽 색면을 길게 당긴 형태' },
  { file: '03-subject-trail.png', label: '03  피사체와 흐름', note: '피사체 뒤의 색만 길게 흐르는 장면' },
  { file: '04-pixel-thread.png', label: '04  픽셀 스레드', note: '한 픽셀이 하나의 리본으로 이어짐' },
  { file: '05-frame-sweep.png', label: '05  프레임 스윕', note: '사진 프레임의 한 줄을 끌어낸 형태' },
];

function roundedImage(ctx, image, x, y, size, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
}

async function main() {
  const canvas = createCanvas(1800, 1190);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#EDF0F6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1E2430';
  ctx.font = '800 48px Wanted';
  ctx.fillText('yourcolor  ·  앱 아이콘 시안 5개', 74, 83);
  ctx.fillStyle = '#697285';
  ctx.font = '500 21px Wanted';
  ctx.fillText('처음 아이콘의 “색이 휘어 길어지는” 동작을 기준으로 다시 만들었습니다.', 76, 119);

  const positions = [[75, 161], [640, 161], [1205, 161], [358, 653], [923, 653]];
  for (let i = 0; i < options.length; i++) {
    const item = options[i];
    const imagePath = path.join(here, item.file);
    if (!fs.existsSync(imagePath)) throw new Error(`Missing ${imagePath}`);
    const icon = await loadImage(imagePath);
    const [x, y] = positions[i];
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(x, y, 520, 455, 30); ctx.fill();
    roundedImage(ctx, icon, x + 143, y + 37, 234, 54);

    ctx.fillStyle = '#F3F5F9';
    ctx.beginPath(); ctx.roundRect(x + 33, y + 306, 74, 74, 16); ctx.fill();
    roundedImage(ctx, icon, x + 46, y + 319, 48, 11);
    ctx.fillStyle = '#7B8496';
    ctx.font = '500 14px Wanted';
    ctx.fillText('48px', x + 48, y + 397);

    ctx.fillStyle = '#1F2632';
    ctx.font = '800 31px Wanted';
    ctx.fillText(item.label, x + 125, y + 344);
    ctx.fillStyle = '#788192';
    ctx.font = '500 18px Wanted';
    ctx.fillText(item.note, x + 125, y + 382);
  }

  ctx.fillStyle = '#8A93A3';
  ctx.font = '500 16px Wanted';
  ctx.fillText('비교용 시안 · 현재 공개 앱/웹/Play 자산에는 적용하지 않았습니다.', 77, 1163);
  fs.writeFileSync(path.join(here, 'compare.png'), canvas.toBuffer('image/png'));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
