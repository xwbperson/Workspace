/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles/index.css', 'utf8');

function extractRule(selector: string): string {
  const selectorStart = stylesheet.indexOf(`${selector} {`);

  if (selectorStart < 0) throw new Error(`找不到样式规则：${selector}`);

  const blockStart = stylesheet.indexOf('{', selectorStart);
  let depth = 0;

  for (let index = blockStart; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === '{') depth += 1;
    if (stylesheet[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) return stylesheet.slice(blockStart + 1, index);
  }

  throw new Error(`样式规则没有闭合：${selector}`);
}

describe('modal layout contract', () => {
  it('keeps the header and footer outside the scrolling content region', () => {
    const modalRule = extractRule('.modal');
    const openModalRule = extractRule('.modal[open]');
    const bodyRule = extractRule('.modal__body');

    expect(modalRule).toMatch(/grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/);
    expect(modalRule).toMatch(/overflow:\s*hidden;/);
    expect(openModalRule).toMatch(/display:\s*grid;/);
    expect(bodyRule).toMatch(/min-height:\s*0;/);
    expect(bodyRule).toMatch(/overflow:\s*auto;/);
  });
});
