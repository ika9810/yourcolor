// Render a more legible pixel-stretch comparison from the bundled sample photo.
// The streaks are literal pixels from one horizontal row of the source image.
const path = require('node:path');
const sharp = require('sharp');

const WIDTH = 480;
const HEIGHT = 600;
const root = path.resolve(__dirname, '..');
const photoPath = path.join(root, 'android/app/src/main/assets/samples/electric-bloom.png');
const maskPath = path.join(root, 'android/app/src/main/assets/samples/electric-bloom-mask.png');

function sample(data, channels, x, y, channel) {
  const x0 = Math.max(0, Math.min(WIDTH - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(HEIGHT - 1, Math.floor(y)));
  const x1 = Math.min(WIDTH - 1, x0 + 1);
  const y1 = Math.min(HEIGHT - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));
  const at = (xx, yy) => data[(yy * WIDTH + xx) * channels + channel];
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

async function renderDramaticBloom() {
  const photo = await sharp(photoPath).resize(WIDTH, HEIGHT, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const mask = await sharp(maskPath).resize(WIDTH, HEIGHT, { fit: 'fill' })
    .extractChannel(3).blur(1).raw().toBuffer();
  const sky = await sharp(photo, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .extract({ left: 0, top: 0, width: WIDTH, height: 65 })
    .resize(WIDTH, HEIGHT, { fit: 'fill' }).raw().toBuffer();

  const out = Buffer.alloc(WIDTH * HEIGHT * 3);
  const sampleRow = 180;
  const fadeStart = 185;
  const fadeLength = 70;

  // Compress the blossom to 80% height, then ease the lower stem back to the
  // bottom edge. This leaves the focal flower intact and the streaks visible.
  const mappedY = new Float64Array(HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    const t = Math.max(0, (y - 325) / (HEIGHT - 1 - 325));
    mappedY[y] = 0.8 * y + ((HEIGHT - 1) * 0.2) * t * t;
  }
  const inverseY = new Float64Array(HEIGHT);
  let sourceY = 0;
  for (let y = 0; y < HEIGHT; y++) {
    const destinationY = y - 8;
    if (destinationY < 0) { inverseY[y] = -1; continue; }
    while (sourceY < HEIGHT - 2 && mappedY[sourceY + 1] < destinationY) sourceY++;
    const span = mappedY[sourceY + 1] - mappedY[sourceY];
    inverseY[y] = sourceY + (destinationY - mappedY[sourceY]) / span;
  }

  for (let y = 0; y < HEIGHT; y++) {
    const t = Math.max(0, Math.min(1, (y - fadeStart) / fadeLength));
    const streakOpacity = t * t * (3 - 2 * t);
    const sy = inverseY[y];
    for (let x = 0; x < WIDTH; x++) {
      const index = (y * WIDTH + x) * 3;
      const stripIndex = (sampleRow * WIDTH + x) * 3;
      const foregroundX = (x - 48) / 0.8;
      const subjectOpacity = sy >= 0 && foregroundX >= 0 && foregroundX < WIDTH
        ? sample(mask, 1, foregroundX, sy, 0) / 255 : 0;
      for (let channel = 0; channel < 3; channel++) {
        const background = sky[index + channel] * (1 - streakOpacity)
          + photo[stripIndex + channel] * streakOpacity;
        const subject = subjectOpacity
          ? sample(photo, 3, foregroundX, sy, channel) : 0;
        out[index + channel] = Math.round(background * (1 - subjectOpacity)
          + subject * subjectOpacity);
      }
    }
  }
  return sharp(out, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).png().toBuffer();
}

module.exports = renderDramaticBloom;
