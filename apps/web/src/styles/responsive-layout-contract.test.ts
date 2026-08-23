/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles/index.css', 'utf8');
const timetablePage = readFileSync('src/features/timetable/TimetablePage.tsx', 'utf8');

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

describe('responsive layout contract', () => {
  it('keeps the feature navigation scrollable without hiding the footer', () => {
    expect(extractRule('.sidebar')).toMatch(/overflow:\s*hidden;/);
    expect(extractRule('.sidebar__group')).toMatch(/min-height:\s*0;/);
    expect(extractRule('.sidebar__group')).toMatch(/overflow-y:\s*auto;/);
    expect(stylesheet).toMatch(/\.sidebar__footer\s*\{\s*flex:\s*none;/);
  });

  it('provides visible keyboard focus for search containers', () => {
    expect(stylesheet).toContain('.search-field:focus-within');
    expect(stylesheet).toContain('.global-search-field:focus-within');
  });

  it('uses compact calendar cells on narrow screens instead of a fixed desktop width', () => {
    expect(stylesheet).toMatch(
      /@media \(max-width:\s*599px\)[\s\S]*?\.month-calendar__weekdays,[\s\S]*?min-width:\s*0;/,
    );
  });

  it('contains wide desktop timetables in a local horizontal scroller', () => {
    expect(timetablePage).toContain('className="timetable-grid-scroll"');
    expect(stylesheet).toMatch(/\.timetable-grid-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
  });
});
