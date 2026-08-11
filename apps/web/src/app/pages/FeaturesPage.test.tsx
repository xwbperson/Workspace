import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { featureCatalog } from '../feature-catalog.js';
import { FeaturesPage } from './FeaturesPage.js';

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal()),
  useQuery: () => ({ data: [] }),
}));

vi.mock('../../platform/preferences/usePreferences.js', () => ({
  usePreferences: () => ({
    preferences: { hiddenFeatureIds: [] },
    save: vi.fn(),
  }),
}));

vi.mock('../../components/ui/ToastProvider.js', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

describe('FeaturesPage', () => {
  it('renders one searchable directory without a common-features section or filter', () => {
    render(
      <MemoryRouter>
        <FeaturesPage />
      </MemoryRouter>,
    );

    expect(screen.queryAllByText('常用功能')).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: '常用' })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: '全部' })).toHaveLength(0);
    expect(screen.getAllByRole('article')).toHaveLength(featureCatalog.length);
  });
});
