import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PageTopbarActions, PageTopbarActionsProvider } from './PageTopbarActions.js';

function Harness(): React.JSX.Element {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <PageTopbarActionsProvider target={target}>
      <div data-testid="topbar-action-host" ref={(element) => setTarget(element)} />
      <PageTopbarActions>
        <button type="button">添加记录</button>
      </PageTopbarActions>
    </PageTopbarActionsProvider>
  );
}

describe('PageTopbarActions', () => {
  it('renders page-specific actions in the workbench topbar host', () => {
    render(<Harness />);

    expect(within(screen.getByTestId('topbar-action-host')).getByText('添加记录')).toBeVisible();
  });
});
