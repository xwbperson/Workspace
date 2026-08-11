import { useEffect, useState } from 'react';
import { remainingTime } from '../../../platform/time/format.js';

export function CountdownDisplay({
  targetAt,
  compact = false,
}: {
  targetAt: string;
  compact?: boolean;
}): React.JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const value = remainingTime(targetAt, now);
  const units = [
    { value: value.days, label: '天' },
    { value: value.hours, label: '时' },
    { value: value.minutes, label: '分' },
    ...(!compact ? [{ value: value.seconds, label: '秒' }] : []),
  ];
  return (
    <div
      className={`countdown-display ${compact ? 'countdown-display--compact' : ''}`}
      aria-label={`${value.expired ? '已经过去' : '还剩'} ${value.days} 天 ${value.hours} 小时 ${value.minutes} 分钟`}
    >
      <span
        className={`countdown-display__state ${value.expired ? 'countdown-display__state--expired' : ''}`}
      >
        {value.expired ? '已经过去' : '还剩'}
      </span>
      <div>
        {units.map((unit) => (
          <span key={unit.label}>
            <strong>{String(unit.value).padStart(2, '0')}</strong>
            <small>{unit.label}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
