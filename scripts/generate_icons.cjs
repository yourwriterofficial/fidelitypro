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

  // 5x7 font representation for 'R', 'P', 'M'
  const R_GRID = [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
  ];

  const P_GRID = [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ];

  const M_GRID = [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ];

  // Fill background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let inBounds = true;
      if (!isMaskable) {
        // Check rounded rectangle corners
        const cx = x < radius ? radius : (x > size - radius ? size - radius : x);
        const cy = y < radius ? radius : (y > size - radius ? size - radius : y);
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (distSq > radius * radius) {
          inBounds = false;
        }
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

  // Draw RPM text centered within 65% safe-zone (ensuring Android circular mask does not clip)
  const scale = Math.floor((size * 0.36) / 7);
  const letterSpacing = Math.floor(scale * 0.75);
  const letterWidth = 5 * scale;
  const letterHeight = 7 * scale;
  const totalW = 3 * letterWidth + 2 * letterSpacing;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - letterHeight) / 2);

  function drawGrid(grid, ox, oy) {
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

  drawGrid(R_GRID, startX, startY);
  drawGrid(P_GRID, startX + letterWidth + letterSpacing, startY);
  drawGrid(M_GRID, startX + 2 * (letterWidth + letterSpacing), startY);

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

console.log('Icons generated successfully in public/icons/');
