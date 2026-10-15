// Review-only calm wordmark option; uses the bundled SUIT font.
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '../../..');
GlobalFonts.registerFromPath(path.join(root, 'legacy/design-prototypes/assets/SUIT-Variable.woff2'), 'SUIT');
const canvas = createCanvas(1100, 240);
const ctx = canvas.getContext('2d');
ctx.font = '600 184px SUIT';
ctx.textBaseline = 'alphabetic';
ctx.fillStyle = '#1C2941';
let x = 65;
for (const letter of 'yourcolor') {
  ctx.fillText(letter, x, 183);
  x += ctx.measureText(letter).width + 3;
}
fs.writeFileSync(path.join(__dirname, '05-quiet.png'), canvas.toBuffer('image/png'));
