/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPngSize(path: string): { width: number; height: number } {
  const content = readFileSync(path);
  expect(content.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
}

describe('PWA icon assets', () => {
  it.each([
    ['public/favicon-32x32.png', 32],
    ['public/apple-touch-icon.png', 180],
    ['public/pwa-192x192.png', 192],
    ['public/pwa-512x512.png', 512],
    ['public/pwa-maskable-512x512.png', 512],
  ])('provides %s at the expected square size', (path, size) => {
    expect(readPngSize(path)).toEqual({ width: size, height: size });
  });

  it('declares browser and Apple icon links in the document head', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('rel="icon" href="/favicon-32x32.png"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"');
  });

  it('declares PNG any-purpose and maskable icons in the generated manifest config', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain("src: '/pwa-192x192.png'");
    expect(config).toContain("src: '/pwa-512x512.png'");
    expect(config).toContain("src: '/pwa-maskable-512x512.png'");
    expect(config).toContain("purpose: 'maskable'");
  });
});
