// Render the approved yourcolor feature graphic from its editable source.
// The output is shared by the README banner and web social preview.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '..');
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
function comparisonLabel(number, label, centerX) {
  ctx.save();
  ctx.font = '700 16px PaperSemi';
  const textWidth = ctx.measureText(label).width;
  const badgeSize = 22;
  const gap = 8;
  const x = centerX - (badgeSize + gap + textWidth) / 2;

  ctx.fillStyle = '#245EE8';
  rounded(x, 29, badgeSize, badgeSize, 7);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 14px PaperSemi';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(number, x + badgeSize / 2, 40);

  ctx.fillStyle = '#35465D';
  ctx.font = '700 16px PaperSemi';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + badgeSize + gap, 40);
  ctx.restore();
}
function comparison(original, edited) {
  const x = 536, y = 61, width = 442, height = 378;
  const originalWidth = 203;
  comparisonLabel('1', '원본', x + originalWidth / 2);
  comparisonLabel('2', 'pixel stretch', x + originalWidth + (width - originalWidth) / 2);
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

async function renderFeatureGraphic() {
  const icon = await loadImage(path.join(root, 'android/release-assets/store-icon.png'));
  const trimmed = await sharp(path.join(root, 'branding/wordmark.png')).trim().png().toBuffer();
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

  return canvas.toBuffer('image/png');
}

module.exports = renderFeatureGraphic;

if (require.main === module) {
  renderFeatureGraphic().then(png => {
    const output = path.join(root, 'android/release-assets/feature-graphic.png');
    fs.writeFileSync(output, png);
    process.stdout.write(`${output}\n`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
