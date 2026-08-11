import type { WorkbenchPreferences } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryClient, workbenchClient } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';

const fallbackPreferences: WorkbenchPreferences = {
  hiddenFeatureIds: [],
  overviewBlockIds: ['countdowns:nearest'],
  theme: 'dark',
  dateDisplay: 'relative',
  notificationsEnabled: true,
  refreshIntervalMinutes: 5,
};

function applyTheme(theme: WorkbenchPreferences['theme']): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  const browserThemeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--browser-theme-color')
    .trim();
  if (browserThemeColor) {
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', browserThemeColor);
  }
}

export function usePreferences(): {
  preferences: WorkbenchPreferences;
  loading: boolean;
  save(input: WorkbenchPreferences): Promise<WorkbenchPreferences>;
  saving: boolean;
} {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['workbench', 'preferences'],
    queryFn: () => workbenchClient.getPreferences(),
    enabled: Boolean(session),
  });
  const mutation = useMutation({
    mutationFn: (input: WorkbenchPreferences) => workbenchClient.updatePreferences(input),
    onMutate: (input) => {
      void queryClient.cancelQueries({ queryKey: ['workbench', 'preferences'] });
      const previous = queryClient.getQueryData<WorkbenchPreferences>(['workbench', 'preferences']);
      queryClient.setQueryData(['workbench', 'preferences'], input);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['workbench', 'preferences'], context.previous);
      }
    },
    onSuccess: (value) => queryClient.setQueryData(['workbench', 'preferences'], value),
  });
  const preferences = query.data ?? fallbackPreferences;

  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  return {
    preferences,
    loading: query.isLoading,
    save: async (input) => mutation.mutateAsync(input),
    saving: mutation.isPending,
  };
}
