/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles/index.css', 'utf8');
const rawColorPattern = /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i;

function extractRule(selector: string): string {
  const selectorStart = stylesheet.indexOf(selector);

  if (selectorStart < 0) throw new Error(`找不到主题规则：${selector}`);

  const blockStart = stylesheet.indexOf('{', selectorStart);
  let depth = 0;

  for (let index = blockStart; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === '{') depth += 1;
    if (stylesheet[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) return stylesheet.slice(blockStart + 1, index);
  }

  throw new Error(`找不到主题规则：${selector}`);
}

function tokenNames(rule: string): string[] {
  return [...rule.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]!).sort();
}

describe('theme contract', () => {
  it('keeps raw colors inside the theme token layer', () => {
    const componentStyles = stylesheet.slice(stylesheet.indexOf('@layer responsive'));

    expect(componentStyles).not.toMatch(rawColorPattern);
  });

  it('requires every theme to implement the same token contract', () => {
    const darkTokens = tokenNames(extractRule(":root[data-theme='dark']"));
    const lightTokens = tokenNames(extractRule(":root[data-theme='light']"));
    const glassTokens = tokenNames(extractRule(":root[data-theme='glass']"));

    expect(darkTokens.length).toBeGreaterThan(0);
    expect(lightTokens).toEqual(darkTokens);
    expect(glassTokens).toEqual(darkTokens);
  });
});
