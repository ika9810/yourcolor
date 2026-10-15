// Temporary review sheet for the post-oval brand directions.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'legacy/branding-explorations/concepts');
fs.mkdirSync(out, { recursive: true });
GlobalFonts.registerFromPath(path.join(root, 'docs/assets/WantedSansVariable.woff2'), 'Wanted');

const options = [
  {
    id: 'pixel-cut',
    label: '01  픽셀 컷',
    note: '한 줄의 색이 아래로 길게 펼쳐지는 심볼',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <linearGradient id="photo" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#153C9C"/><stop offset=".55" stop-color="#2969E8"/><stop offset="1" stop-color="#9CC7F2"/></linearGradient>
        <linearGradient id="left" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#245CD5"/><stop offset="1" stop-color="#173F9C"/></linearGradient>
        <linearGradient id="right" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#91BDF0"/><stop offset="1" stop-color="#356DD0"/></linearGradient>
      </defs>
      <rect width="512" height="512" fill="#F7F7FA"/>
      <rect x="103" y="113" width="306" height="135" rx="21" fill="url(#photo)"/>
      <path d="M216 113h84l-33 135h-73z" fill="#2969E8" opacity=".88"/>
      <path d="M320 113h69a20 20 0 0 1 20 20v94a20 20 0 0 1-20 20h-94z" fill="#83B7EC" opacity=".74"/>
      <path d="M260 135h51l-20 91h-52z" fill="#F27041"/>
      <rect x="103" y="240" width="91" height="126" fill="url(#left)"/>
      <rect x="203" y="240" width="91" height="169" fill="#F27041"/>
      <rect x="303" y="240" width="106" height="143" fill="url(#right)"/>
      <path d="M109 259h78m22 0h79m21 0h94" stroke="#F7F7FA" opacity=".45" stroke-width="3"/>
    </svg>`,
  },
  {
    id: 'y-stretch',
    label: '02  Y 스트레치',
    note: '이름의 Y를 색의 방향과 길이로 표현',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" fill="#202539"/>
      <path d="M107 113h83l88 123-40 57z" fill="#2C69EA"/>
      <path d="M322 113h83L276 293l-42-57z" fill="#F47A4A"/>
      <path d="M218 250h24v157h-24z" fill="#6597F5"/>
      <path d="M246 250h24v157h-24z" fill="#F47A4A"/>
      <path d="M274 250h24v157h-24z" fill="#A9C8FA"/>
      <path d="M218 305h80" stroke="#202539" stroke-width="9"/>
    </svg>`,
  },
  {
    id: 'split-frame',
    label: '03  프레임 스플릿',
    note: '원본과 색이 늘어난 결과를 한 프레임에',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" fill="#F7F7FA"/>
      <rect x="91" y="88" width="330" height="336" rx="29" fill="#202539"/>
      <rect x="109" y="106" width="137" height="300" rx="12" fill="#82B9F1"/>
      <path d="M109 275 156 204l45 58 45-36v180H109z" fill="#245DD8"/>
      <circle cx="201" cy="168" r="24" fill="#F47745"/>
      <rect x="266" y="106" width="137" height="121" rx="12" fill="#82B9F1"/>
      <path d="M266 198 309 140l45 52 49-44v79H266z" fill="#245DD8"/>
      <rect x="266" y="230" width="34" height="176" fill="#245DD8"/>
      <rect x="303" y="230" width="34" height="176" fill="#F47745"/>
      <rect x="340" y="230" width="34" height="176" fill="#4E81E7"/>
      <rect x="377" y="230" width="26" height="176" fill="#9CC7F2"/>
    </svg>`,
  },
];

async function render() {
  const sheet = createCanvas(1680, 930);
  const s = sheet.getContext('2d');
  s.fillStyle = '#ECEEF3'; s.fillRect(0, 0, 1680, 930);
  s.fillStyle = '#20232C'; s.font = '800 44px Wanted'; s.fillText('yourcolor  ·  새 로고 시안', 82, 86);
  s.fillStyle = '#697080'; s.font = '500 20px Wanted'; s.fillText('길쭉한 o와 무지개 링을 제거하고, 픽셀 스트레치 동작에서 심볼을 만들었습니다.', 84, 124);

  for (let i = 0; i < options.length; i++) {
    const item = options[i];
    fs.writeFileSync(path.join(out, `${item.id}.svg`), item.svg);
    const icon = await sharp(Buffer.from(item.svg)).png().toBuffer();
    fs.writeFileSync(path.join(out, `${item.id}.png`), icon);
    const img = await loadImage(icon);
    const x = 66 + i * 540;
    s.fillStyle = '#FFFFFF'; s.beginPath(); s.roundRect(x, 168, 508, 690, 26); s.fill();
    s.fillStyle = '#23232B'; s.font = '800 27px Wanted'; s.fillText(item.label, x + 30, 219);
    s.drawImage(img, x + 103, 259, 300, 300);
    s.drawImage(img, x + 34, 635, 52, 52);
    s.fillStyle = '#23232B'; s.font = '800 53px Wanted'; s.fillText('yourcolor', x + 101, 680);
    s.fillStyle = '#777C89'; s.font = '600 18px Wanted'; s.fillText('픽셀 스트레치', x + 34, 732);
    s.fillStyle = '#747987'; s.font = '500 16px Wanted'; s.fillText(item.note, x + 34, 785);
  }
  fs.writeFileSync(path.join(out, 'compare.png'), sheet.toBuffer('image/png'));
}

render().catch(error => { console.error(error); process.exitCode = 1; });
