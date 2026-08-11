import type { CurrentSessionResponse, LoginInput } from '@workspace/client-sdk';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { queryClient, workbenchClient } from '../api/client.js';

interface AuthContextValue {
  session: CurrentSessionResponse | null;
  loading: boolean;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => workbenchClient.getCurrentSession(),
    retry: false,
    staleTime: 60_000,
  });

  const clearSession = useCallback(() => {
    queryClient.setQueryData(['auth', 'session'], null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
  }, []);

  useEffect(() => {
    const handleUnauthorized = (): void => clearSession();
    window.addEventListener('workbench:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('workbench:unauthorized', handleUnauthorized);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: sessionQuery.data ?? null,
      loading: sessionQuery.isLoading,
      async login(input) {
        const session = await workbenchClient.login(input);
        queryClient.setQueryData(['auth', 'session'], session);
      },
      async logout() {
        await workbenchClient.logout();
        clearSession();
      },
    }),
    [clearSession, sessionQuery.data, sessionQuery.isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用。');
  return value;
}

export function isSafeReturnTo(value: string | null): value is string {
  return Boolean(value && /^\/(?!\/)[^\s]*$/.test(value));
}
