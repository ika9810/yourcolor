// Text-only 01/02 wordmark concepts. Run with @napi-rs/canvas available to Node.
// Example: NODE_PATH=/path/to/node_modules node legacy/branding-explorations/wordmark-round2/build-strong-two-tone.cjs
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '../../..');
const fonts = [
  ['WantedExtra', 'android/app/src/main/assets/fonts/WantedSansExtraBold.ttf'],
  ['PaperBold', 'android/app/src/main/assets/fonts/Paperlogy-7Bold.ttf'],
  ['PaperSemi', 'android/app/src/main/assets/fonts/Paperlogy-6SemiBold.ttf'],
];
for (const [family, file] of fonts) {
  if (!GlobalFonts.registerFromPath(path.join(root, file), family)) {
    throw new Error(`Could not load ${family}`);
  }
}

const WIDTH = 1100;
const HEIGHT = 240;

function render(name, paint) {
  const source = createCanvas(1400, 400);
  const ctx = source.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  paint(ctx);

  const pixels = ctx.getImageData(0, 0, source.width, source.height).data;
  let left = source.width, top = source.height, right = -1, bottom = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (pixels[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width > WIDTH - 24 || height > HEIGHT - 16) {
    throw new Error(`${name} exceeds the safe canvas: ${width}×${height}`);
  }
  const output = createCanvas(WIDTH, HEIGHT);
  output.getContext('2d').drawImage(
    source, left, top, width, height,
    Math.floor((WIDTH - width) / 2), Math.floor((HEIGHT - height) / 2), width, height,
  );
  fs.writeFileSync(path.join(__dirname, name), output.toBuffer('image/png'));
  console.log(`${name}: ${width}×${height} artwork on ${WIDTH}×${HEIGHT} transparent canvas`);
}

render('01-strong.png', ctx => {
  ctx.font = '220px WantedExtra';
  ctx.fillStyle = '#22232c';
  ctx.fillText('yourcolor', 100, 270);
});

render('02-two-tone.png', ctx => {
  ctx.font = '205px PaperBold';
  ctx.fillStyle = '#22232c';
  ctx.fillText('your', 100, 270);
  const firstWidth = ctx.measureText('your').width;
  ctx.font = '205px PaperSemi';
  ctx.fillStyle = '#235fe9';
  ctx.fillText('color', 100 + firstWidth - 7, 270);
});
