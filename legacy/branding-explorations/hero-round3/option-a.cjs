// Review mockup A: paired gallery cards for the yourcolor feature graphic.
// Run with NODE_PATH pointed at the bundled Node dependencies.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '../../..');
const here = __dirname;
GlobalFonts.registerFromPath(path.join(root, 'android/app/src/main/assets/fonts/WantedSansExtraBold.ttf'), 'WantedExtra');
GlobalFonts.registerFromPath(path.join(root, 'android/app/src/main/assets/fonts/Paperlogy-6SemiBold.ttf'), 'PaperSemi');
GlobalFonts.registerFromPath(path.join(root, 'android/app/src/main/assets/fonts/Paperlogy-4Regular.ttf'), 'PaperRegular');

const canvas = createCanvas(1024, 500);
const ctx = canvas.getContext('2d');

function rounded(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
function cover(image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  ctx.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height);
}
function comparison(original, edited) {
  const x = 536, y = 61, width = 442, height = 378;
  const originalWidth = 203;
  ctx.save();
  ctx.shadowColor = '#25508B35';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 13;
  ctx.fillStyle = '#fff';
  rounded(x, y, width, height, 24);
  ctx.fill();
  ctx.restore();

  ctx.save();
  rounded(x, y, width, height, 24);
  ctx.clip();
  cover(original, x, y, originalWidth, height);
  cover(edited, x + originalWidth, y, width - originalWidth, height);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + originalWidth - 2, y, 4, height);
  ctx.restore();
}

async function main() {
  const icon = await loadImage(path.join(root, 'legacy/branding-explorations/icon-round2/01-twin-pull.png'));
  const trimmed = await sharp(path.join(root, 'legacy/branding-explorations/wordmark-round2/01-strong.png')).trim().png().toBuffer();
  const wordmark = await loadImage(trimmed);
  const original = await loadImage(path.join(root, 'android/app/src/main/assets/samples/electric-bloom.png'));
  const edited = await loadImage(path.join(root, 'android/app/src/main/assets/samples/electric-bloom-art.png'));

  const background = ctx.createLinearGradient(0, 0, 1024, 500);
  background.addColorStop(0, '#FCFCFF');
  background.addColorStop(.56, '#F9FBFF');
  background.addColorStop(1, '#EFF5FF');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 500);

  // A soft tint adds depth behind the photograph without competing with it.
  const halo = ctx.createRadialGradient(795, 250, 10, 795, 250, 410);
  halo.addColorStop(0, '#DFEBFF');
  halo.addColorStop(1, '#EFF5FF00');
  ctx.fillStyle = halo;
  ctx.fillRect(480, 0, 544, 500);

  // The app name is held together as one lockup: icon, wordmark, and suffix.
  ctx.drawImage(icon, 38, 38, 436, 436, 62, 62, 57, 57);
  ctx.drawImage(wordmark, 135, 62, 286, 57);

  ctx.fillStyle = '#426080';
  ctx.font = '700 17px PaperSemi';
  ctx.fillText('나만의 pixel stretch', 136, 147);
  ctx.fillStyle = '#20232B';
  ctx.font = '700 48px WantedExtra';
  ctx.fillText('너의 순간을,', 61, 264);
  ctx.fillStyle = '#245EE8';
  ctx.fillText('조금 더 길게.', 61, 324);
  ctx.fillStyle = '#596778';
  ctx.font = '400 19px PaperRegular';
  ctx.fillText('사진 속 색을 펼쳐 만드는', 64, 388);
  ctx.fillText('나만의 픽셀 스트레치.', 64, 418);

  comparison(original, edited);

  const output = path.join(here, 'option-a.png');
  fs.writeFileSync(output, canvas.toBuffer('image/png'));
  process.stdout.write(`${output}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
