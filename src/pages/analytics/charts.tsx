import type { NamedCount, TimePoint } from '../../lib/analytics/types';

function maxCount(points: Array<{ count: number }>): number {
  return Math.max(1, ...points.map((p) => p.count));
}

function shortLabel(t: string): string {
  if (t.includes('T')) {
    const hour = t.slice(11, 13);
    return `${hour}h`;
  }
  return t.slice(5); // MM-DD
}

export function SparkLine({
  data,
  color = '#c2a4ff',
}: {
  data: TimePoint[];
  color?: string;
}) {
  if (!data.length) {
    return <div className="analytics-empty-inline">No activity in range</div>;
  }

  const w = 320;
  const h = 96;
  const pad = 8;
  const max = maxCount(data);
  const coords = data.map((point, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const y = h - pad - (point.count / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const fillPoints = [
    `${pad},${h - pad}`,
    ...coords,
    `${w - pad},${h - pad}`,
  ].join(' ');

  return (
    <svg
      className="analytics-spark"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Trend chart"
    >
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={fillPoints}
        fill={`url(#spark-fill-${color.replace('#', '')})`}
      />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g className="analytics-spark-labels">
        {data.map((point, i) => {
          if (data.length > 10 && i % Math.ceil(data.length / 6) !== 0) {
            return null;
          }
          const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
          return (
            <text key={point.t} x={x} y={h - 1} textAnchor="middle">
              {shortLabel(point.t)}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

export function BarList({
  items,
  color = '#c2a4ff',
}: {
  items: NamedCount[];
  color?: string;
}) {
  if (!items.length) {
    return <div className="analytics-empty-inline">No data yet</div>;
  }

  const max = maxCount(items);

  return (
    <ul className="analytics-bar-list">
      {items.map((item) => (
        <li key={item.label}>
          <div className="analytics-bar-meta">
            <span title={item.label}>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
          <div className="analytics-bar-track">
            <div
              className="analytics-bar-fill"
              style={{
                width: `${Math.max(4, (item.count / max) * 100)}%`,
                background: `linear-gradient(90deg, ${color}, #fb8dff)`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RankList({
  items,
}: {
  items: Array<{ path: string; views: number }>;
}) {
  if (!items.length) {
    return <div className="analytics-empty-inline">No page views yet</div>;
  }

  const max = Math.max(1, ...items.map((i) => i.views));

  return (
    <ol className="analytics-rank-list">
      {items.map((item, index) => (
        <li key={item.path}>
          <span className="analytics-rank-index">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="analytics-rank-body">
            <div className="analytics-bar-meta">
              <span title={item.path}>{item.path}</span>
              <strong>{item.views}</strong>
            </div>
            <div className="analytics-bar-track">
              <div
                className="analytics-bar-fill"
                style={{
                  width: `${Math.max(4, (item.views / max) * 100)}%`,
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
