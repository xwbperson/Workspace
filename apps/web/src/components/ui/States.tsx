import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';

export function PageLoader({ label = '正在加载工作台' }: { label?: string }): React.JSX.Element {
  return (
    <div className="page-state" role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function SectionError({
  title = '这部分暂时无法加载',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}): React.JSX.Element {
  return (
    <div className="section-state section-state--error" role="alert">
      <AlertCircle aria-hidden="true" size={20} />
      <div>
        <strong>{title}</strong>
        {message ? <p>{message}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" className="button button--quiet" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={16} /> 重试
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="empty-state">
      <span className="empty-state__line" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
