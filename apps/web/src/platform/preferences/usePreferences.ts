import type { WorkbenchPreferences } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryClient, workbenchClient } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';

const fallbackPreferences: WorkbenchPreferences = {
  pinnedFeatureIds: ['countdowns'],
  overviewBlockIds: ['countdowns:nearest'],
  theme: 'system',
  dateDisplay: 'relative',
  notificationsEnabled: true,
  refreshIntervalMinutes: 5,
};

function resolveTheme(theme: WorkbenchPreferences['theme']): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    onSuccess: (value) => queryClient.setQueryData(['workbench', 'preferences'], value),
  });
  const preferences = query.data ?? fallbackPreferences;

  useEffect(() => {
    const apply = (): void => {
      document.documentElement.dataset.theme = resolveTheme(preferences.theme);
      document.documentElement.style.colorScheme = resolveTheme(preferences.theme);
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme]);

  return {
    preferences,
    loading: query.isLoading,
    save: async (input) => mutation.mutateAsync(input),
    saving: mutation.isPending,
  };
}
