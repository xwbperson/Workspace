import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const PageTopbarActionsTargetContext = createContext<HTMLElement | null>(null);

export function PageTopbarActionsProvider({
  target,
  children,
}: {
  target: HTMLElement | null;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <PageTopbarActionsTargetContext.Provider value={target}>
      {children}
    </PageTopbarActionsTargetContext.Provider>
  );
}

export function PageTopbarActions({ children }: { children: ReactNode }): React.ReactPortal | null {
  const target = useContext(PageTopbarActionsTargetContext);
  return target ? createPortal(children, target) : null;
}
