import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, BellRing, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { humanizeApiError, queryClient, workbenchClient } from '../../platform/api/client.js';
import { formatDateTime, formatRelativeTime } from '../../platform/time/format.js';
import { useToast } from '../../components/ui/ToastProvider.js';

export function NotificationsPage(): React.JSX.Element {
  const { show } = useToast();
  const query = useQuery({
    queryKey: ['workbench', 'notifications'],
    queryFn: () => workbenchClient.getNotifications(),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => workbenchClient.markNotificationRead(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['workbench', 'notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => workbenchClient.markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workbench', 'notifications'] });
      show('全部通知已标记为已读');
    },
  });
  const unread = query.data?.filter((item) => !item.readAt).length ?? 0;

  return (
    <div className="notifications-page page-stack">
      <header className="page-intro">
        <div>
          <p className="eyebrow">{unread} 条未读</p>
          <h2>需要知道的事，集中在这里。</h2>
          <p>时间节点和系统结果不会混入普通动态。</p>
        </div>
        <button
          type="button"
          className="button button--quiet"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck aria-hidden="true" size={17} /> 全部已读
        </button>
      </header>
      {query.isError ? (
        <SectionError
          message={humanizeApiError(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data?.length ? (
        <div className="notification-list">
          {query.data.map((notification) => {
            const content = (
              <>
                <span className={`notification-icon notification-icon--${notification.severity}`}>
                  {notification.readAt ? (
                    <Bell aria-hidden="true" />
                  ) : (
                    <BellRing aria-hidden="true" />
                  )}
                </span>
                <span className="notification-copy">
                  <span>
                    <strong>{notification.title}</strong>
                    {!notification.readAt ? <i>未读</i> : null}
                  </span>
                  {notification.summary ? <p>{notification.summary}</p> : null}
                  <small title={formatDateTime(notification.occurredAt)}>
                    {formatRelativeTime(notification.occurredAt)} ·{' '}
                    {notification.source.kind === 'feature' ? '倒计时' : '系统'}
                  </small>
                </span>
                <ArrowRight aria-hidden="true" />
              </>
            );
            return notification.targetRoute ? (
              <Link
                className={`notification-row ${notification.readAt ? '' : 'notification-row--unread'}`}
                key={notification.notificationId}
                to={notification.targetRoute}
                onClick={() => {
                  if (!notification.readAt) markRead.mutate(notification.notificationId);
                }}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                className={`notification-row ${notification.readAt ? '' : 'notification-row--unread'}`}
                key={notification.notificationId}
                onClick={() => markRead.mutate(notification.notificationId)}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : !query.isLoading ? (
        <EmptyState
          title="没有通知"
          description="倒计时到达或备份任务产生结果时，会在这里留下清楚的记录。"
        />
      ) : (
        <div className="skeleton-list">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}
    </div>
  );
}
