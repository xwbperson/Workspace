import type { WorkbenchPreferences } from '@workspace/client-sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { featureCatalog } from '../feature-catalog.js';
import { SidebarFeatureSettings } from './SidebarFeatureSettings.js';

const preferences: WorkbenchPreferences = {
  hiddenFeatureIds: [],
  sidebarFeatureOrder: [],
  overviewBlockIds: [],
  theme: 'dark',
  dateDisplay: 'relative',
  notificationsEnabled: true,
  refreshIntervalMinutes: 5,
};

describe('SidebarFeatureSettings', () => {
  it('moves a feature and saves the complete sidebar order', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<SidebarFeatureSettings preferences={preferences} saving={false} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '下移倒计时' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sidebarFeatureOrder: [
          'books',
          'countdowns',
          ...featureCatalog.slice(2).map((feature) => feature.featureId),
        ],
      }),
    );
  });

  it('can restore the catalog order without changing visibility', async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <SidebarFeatureSettings
        preferences={{
          ...preferences,
          hiddenFeatureIds: ['books'],
          sidebarFeatureOrder: ['books', 'countdowns'],
        }}
        saving={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '恢复默认顺序' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ hiddenFeatureIds: ['books'], sidebarFeatureOrder: [] }),
    );
  });
});
