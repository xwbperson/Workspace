import type { OverviewBlock } from '@workspace/client-sdk';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { OverviewBlockView } from './OverviewPage.js';

const blocks: OverviewBlock[] = [
  {
    featureId: 'goals',
    blockId: 'goals.progress',
    title: '目标推进',
    priority: 10,
    targetRoute: '/features/goals',
    data: { kind: 'progress', current: 1, total: 2, label: '1 / 2', updatedAt: '2026-08-12' },
  },
  {
    featureId: 'tasks',
    blockId: 'tasks.pending',
    title: '待推进任务',
    priority: 20,
    targetRoute: '/features/tasks',
    data: { kind: 'metric', value: 3, label: '待办', updatedAt: '2026-08-12' },
  },
  {
    featureId: 'calendar',
    blockId: 'calendar.upcoming',
    title: '近期日程',
    priority: 30,
    targetRoute: '/features/calendar',
    data: { kind: 'upcoming', items: [], updatedAt: '2026-08-12' },
  },
];

describe('OverviewBlockView', () => {
  it.each([
    ['goals', '来自目标管理'],
    ['tasks', '来自任务管理'],
    ['calendar', '来自日程管理'],
  ])('shows the real feature source for %s', (featureId, sourceLabel) => {
    render(
      <MemoryRouter>
        <OverviewBlockView block={blocks.find((block) => block.featureId === featureId)!} />
      </MemoryRouter>,
    );

    expect(screen.getByText(sourceLabel)).toBeVisible();
    expect(screen.queryByText('来自倒计时')).not.toBeInTheDocument();
    if (featureId === 'calendar') {
      expect(screen.getByRole('heading', { name: '暂无近期日程' })).toBeVisible();
      expect(screen.getByText('在日程管理中添加或更新内容后，会显示在这里。')).toBeVisible();
    }
  });
});
