const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Brand color: #00674F -> R: 0, G: 103, B: 79
const BRAND_R = 0;
const BRAND_G = 103;
const BRAND_B = 79;

function createIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });
  const radius = isMaskable ? 0 : size * 0.22; // rounded for standard, full-bleed for maskable

// 5x7 Font definitions for 'R', 'P', 'M'
const R_GRID = [
  [1,1,1,1,0],
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,1,1,1,0],
  [1,0,1,0,0],
  [1,0,0,1,0],
  [1,0,0,0,1]
];

const P_GRID = [
  [1,1,1,1,0],
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,1,1,1,0],
  [1,0,0,0,0],
  [1,0,0,0,0],
  [1,0,0,0,0]
];

const M_GRID = [
  [1,0,0,0,1],
  [1,1,0,1,1],
  [1,0,1,0,1],
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,0,0,0,1]
];

// Android Status Bar Badge with 'RPM' (100% transparent background, solid white letters)
function createBadge(size) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < size * size * 4; i += 4) {
    png.data[i] = 0;
    png.data[i+1] = 0;
    png.data[i+2] = 0;
    png.data[i+3] = 0;
  }

  const scale = Math.floor((size * 0.72) / 17);
  const letterW = 5 * scale;
  const letterH = 7 * scale;
  const spacing = Math.floor(scale * 1.0);
  const totalW = 3 * letterW + 2 * spacing;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - letterH) / 2);

  function drawLetter(grid, ox, oy) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c]) {
          for (let py = 0; py < scale; py++) {
            for (let px = 0; px < scale; px++) {
              const x = ox + c * scale + px;
              const y = oy + r * scale + py;
              if (x >= 0 && x < size && y >= 0 && y < size) {
                const idx = (size * y + x) << 2;
                png.data[idx] = 255;
                png.data[idx+1] = 255;
                png.data[idx+2] = 255;
                png.data[idx+3] = 255;
              }
            }
          }
        }
      }
    }
  }

  drawLetter(R_GRID, startX, startY);
  drawLetter(P_GRID, startX + letterW + spacing, startY);
  drawLetter(M_GRID, startX + 2 * (letterW + spacing), startY);

  return png;
}

function createIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });
  const radius = isMaskable ? 0 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let inBounds = true;
      if (!isMaskable) {
        const cx = x < radius ? radius : (x > size - radius ? size - radius : x);
        const cy = y < radius ? radius : (y > size - radius ? size - radius : y);
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (distSq > radius * radius) inBounds = false;
      }
      if (inBounds) {
        png.data[idx] = BRAND_R;
        png.data[idx + 1] = BRAND_G;
        png.data[idx + 2] = BRAND_B;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }

  const maxWRatio = isMaskable ? 0.58 : 0.68;
  const scale = Math.floor((size * maxWRatio) / 17);
  const letterW = 5 * scale;
  const letterH = 7 * scale;
  const spacing = Math.floor(scale * 1.0);
  const totalW = 3 * letterW + 2 * spacing;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - letterH) / 2);

  function drawLetter(grid, ox, oy) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c]) {
          for (let py = 0; py < scale; py++) {
            for (let px = 0; px < scale; px++) {
              const x = ox + c * scale + px;
              const y = oy + r * scale + py;
              if (x >= 0 && x < size && y >= 0 && y < size) {
                const idx = (size * y + x) << 2;
                png.data[idx] = 255;
                png.data[idx + 1] = 255;
                png.data[idx + 2] = 255;
                png.data[idx + 3] = 255;
              }
            }
          }
        }
      }
    }
  }

  drawLetter(R_GRID, startX, startY);
  drawLetter(P_GRID, startX + letterW + spacing, startY);
  drawLetter(M_GRID, startX + 2 * (letterW + spacing), startY);

  return png;
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Standard 192x192
const p192 = createIcon(192, false);
fs.writeFileSync(path.join(outDir, 'icon-192x192.png'), PNG.sync.write(p192));

// 2. Standard 512x512
const p512 = createIcon(512, false);
fs.writeFileSync(path.join(outDir, 'icon-512x512.png'), PNG.sync.write(p512));

// 3. Maskable 192x192 (for Android Adaptive icons)
const m192 = createIcon(192, true);
fs.writeFileSync(path.join(outDir, 'maskable-icon-192x192.png'), PNG.sync.write(m192));

// 4. Maskable 512x512 (for Android Adaptive icons)
const m512 = createIcon(512, true);
fs.writeFileSync(path.join(outDir, 'maskable-icon-512x512.png'), PNG.sync.write(m512));

// 5. Android Notification Badges (Transparent background for status bar)
fs.writeFileSync(path.join(outDir, 'badge-96x96.png'), PNG.sync.write(createBadge(96)));
fs.writeFileSync(path.join(outDir, 'badge-72x72.png'), PNG.sync.write(createBadge(72)));
fs.writeFileSync(path.join(outDir, 'badge-48x48.png'), PNG.sync.write(createBadge(48)));

console.log('Icons and badges generated successfully in public/icons/');
