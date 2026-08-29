import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(scriptDirectory, '../apps/web/public');

const COLORS = {
  background: [0x17, 0x6b, 0x5b],
  stripe: [0xf2, 0xf7, 0xf5],
  accent: [0xd9, 0xa4, 0x41],
};

const outputs = [
  { filename: 'favicon-32x32.png', size: 32, fullBleed: false, samples: 8 },
  { filename: 'apple-touch-icon.png', size: 180, fullBleed: true, samples: 4 },
  { filename: 'pwa-192x192.png', size: 192, fullBleed: false, samples: 4 },
  { filename: 'pwa-512x512.png', size: 512, fullBleed: false, samples: 4 },
  { filename: 'pwa-maskable-512x512.png', size: 512, fullBleed: true, samples: 4 },
];

function insideRoundedSquare(x, y, radius = 16) {
  const qx = Math.abs(x - 32) - (32 - radius);
  const qy = Math.abs(y - 32) - (32 - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside <= radius;
}

function insideHorizontalStroke(x, y, start, end, centerY, radius = 2.5) {
  const dx = x < start ? start - x : x > end ? x - end : 0;
  return Math.hypot(dx, y - centerY) <= radius;
}

function colorAt(x, y, fullBleed) {
  if (!fullBleed && !insideRoundedSquare(x, y)) return undefined;

  let color = COLORS.background;
  if (
    insideHorizontalStroke(x, y, 17, 47, 18) ||
    insideHorizontalStroke(x, y, 17, 36, 32) ||
    insideHorizontalStroke(x, y, 17, 47, 46)
  ) {
    color = COLORS.stripe;
  }
  if (Math.hypot(x - 43, y - 32) <= 6) color = COLORS.accent;
  return color;
}

function renderIcon(size, fullBleed, samples) {
  const pixels = Buffer.alloc(size * size * 4);
  const sampleCount = samples * samples;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let opaqueSamples = 0;
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sampleY = 0; sampleY < samples; sampleY += 1) {
        for (let sampleX = 0; sampleX < samples; sampleX += 1) {
          const sourceX = ((x + (sampleX + 0.5) / samples) * 64) / size;
          const sourceY = ((y + (sampleY + 0.5) / samples) * 64) / size;
          const color = colorAt(sourceX, sourceY, fullBleed);
          if (!color) continue;
          opaqueSamples += 1;
          red += color[0];
          green += color[1];
          blue += color[2];
        }
      }

      const offset = (y * size + x) * 4;
      if (opaqueSamples > 0) {
        pixels[offset] = Math.round(red / opaqueSamples);
        pixels[offset + 1] = Math.round(green / opaqueSamples);
        pixels[offset + 2] = Math.round(blue / opaqueSamples);
      }
      pixels[offset + 3] = Math.round((opaqueSamples / sampleCount) * 255);
    }
  }

  return encodePng(size, size, pixels);
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

await mkdir(publicDirectory, { recursive: true });
for (const output of outputs) {
  const png = renderIcon(output.size, output.fullBleed, output.samples);
  await writeFile(resolve(publicDirectory, output.filename), png);
  process.stdout.write(`${output.filename} ${output.size}x${output.size}\n`);
}
