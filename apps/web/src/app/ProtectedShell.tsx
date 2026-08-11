import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/ui/States.js';
import { useAuth } from '../platform/auth/AuthProvider.js';
import { WorkbenchShell } from './layout/WorkbenchShell.js';

export function ProtectedShell(): React.JSX.Element {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="app-loading">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <PageLoader />
      </div>
    );
  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <WorkbenchShell />;
}
