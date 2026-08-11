import type { CountdownRepository } from '../../features/countdowns/repository.js';
import type { NotificationRepository } from './repository.js';

export async function syncReachedCountdownNotifications(
  countdowns: CountdownRepository,
  notifications: NotificationRepository,
): Promise<number> {
  const reached = await countdowns.reachedWithoutNotification(100);
  for (const countdown of reached) {
    await notifications.publish({
      notificationId: `countdown-reached:${countdown.id}`,
      source: { kind: 'feature', featureId: 'countdowns' },
      type: 'countdown-reached',
      severity: 'warning',
      title: `倒计时已到：${countdown.title}`,
      ...(countdown.note ? { summary: countdown.note } : {}),
      occurredAt: countdown.targetAt,
      targetRoute: `/features/countdowns/${countdown.id}`,
      requiresAction: false,
    });
  }
  return reached.length;
}

export function startCountdownNotificationScheduler(
  countdowns: CountdownRepository,
  notifications: NotificationRepository,
  onError: (error: unknown) => void,
): () => void {
  const run = (): void => {
    void syncReachedCountdownNotifications(countdowns, notifications).catch(onError);
  };
  run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
