import { ApiClientError, WorkbenchClient } from '@workspace/client-sdk';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

export const workbenchClient = new WorkbenchClient('/api/v1');

function reportUnauthorized(error: unknown): void {
  if (error instanceof ApiClientError && error.status === 401) {
    window.dispatchEvent(new CustomEvent('workbench:unauthorized'));
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportUnauthorized }),
  mutationCache: new MutationCache({ onError: reportUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiClientError && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export function humanizeApiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return '操作没有完成，请稍后重试。';
}
