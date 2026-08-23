import { describe, expect, it } from 'vitest';
import { resolveWorkbenchShortcut } from './keyboard-shortcuts.js';

describe('workbench keyboard shortcuts', () => {
  it('does not navigate while the user is typing or a modal is open', () => {
    const input = document.createElement('input');
    expect(
      resolveWorkbenchShortcut(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
        input,
        false,
      ),
    ).toBeUndefined();
    expect(
      resolveWorkbenchShortcut(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
        document.body,
        true,
      ),
    ).toBeUndefined();
  });

  it('keeps search on Ctrl K and uses Alt N for quick create', () => {
    expect(
      resolveWorkbenchShortcut(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
        document.body,
        false,
      ),
    ).toBe('search');
    expect(
      resolveWorkbenchShortcut(
        new KeyboardEvent('keydown', { key: 'n', altKey: true }),
        document.body,
        false,
      ),
    ).toBe('create');
    expect(
      resolveWorkbenchShortcut(
        new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }),
        document.body,
        false,
      ),
    ).toBeUndefined();
  });
});
