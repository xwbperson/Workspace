import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownDisplay } from './CountdownDisplay.js';

describe('CountdownDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('shows the live remaining duration with an accessible summary', () => {
    render(<CountdownDisplay targetAt="2030-01-02T02:03:04.000Z" />);
    expect(screen.getByLabelText('还剩 1 天 2 小时 3 分钟')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText('秒')).toBeInTheDocument();
  });

  it('communicates expired targets instead of displaying a negative value', () => {
    render(<CountdownDisplay targetAt="2029-12-31T23:00:00.000Z" compact />);
    expect(screen.getByLabelText('已经过去 0 天 1 小时 0 分钟')).toBeInTheDocument();
    expect(screen.getByText('已经过去')).toBeInTheDocument();
    expect(screen.queryByText('秒')).not.toBeInTheDocument();
  });
});
