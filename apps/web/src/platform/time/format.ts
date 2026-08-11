import { format, formatDistanceToNowStrict, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatDateTime(value: string | Date): string {
  return format(new Date(value), 'yyyy年M月d日 HH:mm', { locale: zhCN });
}

export function formatShortDateTime(value: string | Date): string {
  return format(new Date(value), 'M月d日 HH:mm', { locale: zhCN });
}

export function formatRelativeTime(value: string | Date): string {
  const date = new Date(value);
  const distance = formatDistanceToNowStrict(date, { locale: zhCN, addSuffix: true });
  return isPast(date) ? distance : distance;
}

export interface RemainingTime {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function remainingTime(target: string | Date, now = new Date()): RemainingTime {
  const delta = new Date(target).getTime() - now.getTime();
  const absoluteSeconds = Math.floor(Math.abs(delta) / 1000);
  return {
    expired: delta <= 0,
    days: Math.floor(absoluteSeconds / 86_400),
    hours: Math.floor((absoluteSeconds % 86_400) / 3_600),
    minutes: Math.floor((absoluteSeconds % 3_600) / 60),
    seconds: absoluteSeconds % 60,
  };
}
