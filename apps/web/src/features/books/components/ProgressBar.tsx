import type { ReadingProgress } from '@workspace/client-sdk';

export function ProgressBar({
  progress,
  compact = false,
}: {
  progress: ReadingProgress;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div className={`reading-progress ${compact ? 'reading-progress--compact' : ''}`}>
      <div>
        <span>阅读进度</span>
        <strong>{progress.percentage}%</strong>
      </div>
      <span
        className="reading-progress__track"
        role="progressbar"
        aria-label={`阅读进度 ${progress.percentage}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percentage}
      >
        <i style={{ width: `${progress.percentage}%` }} />
      </span>
      {!compact ? (
        <small>
          已读 {progress.readPages} / {progress.totalPages} 页（按章节起止页统计）
        </small>
      ) : null}
    </div>
  );
}
