import type { GoalMeasurement } from '@workspace/client-sdk';

export function GoalTrendChart({
  measurements,
  unit,
}: {
  measurements: GoalMeasurement[];
  unit: string;
}): React.JSX.Element {
  if (measurements.length < 2) {
    return <p className="trend-chart__empty">再记录一次当前数值后，这里会显示变化折线。</p>;
  }
  const width = 620;
  const height = 210;
  const padding = 28;
  const values = measurements.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = measurements.map((item, index) => ({
    ...item,
    x: padding + (index / Math.max(1, measurements.length - 1)) * (width - padding * 2),
    y: height - padding - ((item.value - min) / range) * (height - padding * 2),
  }));

  return (
    <div className="trend-chart">
      <svg
        role="img"
        aria-label={`目标数值变化，共 ${measurements.length} 次记录`}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          className="trend-chart__axis"
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        <polyline
          className="trend-chart__line"
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        />
        {points.map((point) => (
          <g key={point.id}>
            <circle className="trend-chart__point" cx={point.x} cy={point.y} r="5" />
            <title>{`${point.value}${unit} · ${new Date(point.recordedAt).toLocaleString('zh-CN')}`}</title>
          </g>
        ))}
      </svg>
      <div className="trend-chart__legend">
        <span>
          {min.toLocaleString()} {unit}
        </span>
        <span>
          {max.toLocaleString()} {unit}
        </span>
      </div>
    </div>
  );
}
