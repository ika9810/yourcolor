// Render two text-only wordmark directions from the repository's licensed fonts.
// Requires Node 20+ and @napi-rs/canvas (provided by the Codex workspace runtime).
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '../../..');
const output = __dirname;
const fontRoot = path.join(root, 'android/app/src/main/assets/fonts');
if (!GlobalFonts.registerFromPath(path.join(fontRoot, 'Paperlogy-7Bold.ttf'), 'Paperlogy Bold')) {
  throw new Error('Could not load Paperlogy Bold');
}
if (!GlobalFonts.registerFromPath(path.join(fontRoot, 'WantedSansExtraBold.ttf'), 'Wanted ExtraBold')) {
  throw new Error('Could not load Wanted Sans ExtraBold');
}

const W = 1100;
const H = 240;
const scratchW = 2200;
const scratchH = 480;

function textWidth(ctx, text, tracking) {
  return [...text].reduce((width, character, index) =>
    width + ctx.measureText(character).width + (index ? tracking : 0), 0);
}

function drawLetters(ctx, text, tracking, colors) {
  let x = 0;
  for (const [index, character] of [...text].entries()) {
    ctx.fillStyle = colors[index];
    ctx.fillText(character, x, 0);
    x += ctx.measureText(character).width + tracking;
  }
}

function alphaBounds(ctx) {
  const { data, width, height } = ctx.getImageData(0, 0, scratchW, scratchH);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 4) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) throw new Error('Wordmark rendered empty');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function render(filename, draw, maxHeight = 164) {
  const scratch = createCanvas(scratchW, scratchH);
  const sc = scratch.getContext('2d');
  draw(sc);
  const box = alphaBounds(sc);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.min(1040 / box.width, maxHeight / box.height);
  const dw = box.width * scale, dh = box.height * scale;
  ctx.drawImage(scratch, box.left, box.top, box.width, box.height,
    (W - dw) / 2, (H - dh) / 2, dw, dh);
  fs.writeFileSync(path.join(output, filename), canvas.toBuffer('image/png'));
}

// 03: measured, wide-tracked editorial typography. The generous spacing is
// retained when the mark is shown at approximately 150 px wide.
render('03-editorial.png', ctx => {
  const text = 'YOURCOLOR';
  const tracking = 16;
  ctx.font = '700 182px "Paperlogy Bold"';
  ctx.textBaseline = 'alphabetic';
  const width = textWidth(ctx, text, tracking);
  ctx.translate((scratchW - width) / 2, 304);
  drawLetters(ctx, text, tracking, [...text].map(() => '#20232d'));
});

// 04: a single forward-leaning lowercase word, with color on the existing
// letters rather than a separate symbol or a stretched o.
render('04-motion.png', ctx => {
  const text = 'yourcolor';
  const tracking = -5;
  ctx.font = '800 216px "Wanted ExtraBold"';
  ctx.textBaseline = 'alphabetic';
  const width = textWidth(ctx, text, tracking);
  const shear = -0.16;
  ctx.translate((scratchW - width) / 2 + 30, 310);
  ctx.transform(1, 0, shear, 1, 0, 0);
  drawLetters(ctx, text, tracking,
    [...text].map((_, index) => index < 4 ? '#20232d' : '#225cde'));
}, 205);
