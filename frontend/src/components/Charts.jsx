import { useState, useRef } from 'react';

// Horizontal bar chart: one series, one hue, value labels at the bar end, hover tooltip.
export function BarList({ data, label, value, format = (v) => v, tooltip, max }) {
  const top = max ?? Math.max(...data.map(value), 1);
  return (
    <ul className="barlist">
      {data.map((d) => {
        const v = value(d);
        return (
          <li key={label(d)} className="barlist-row" tabIndex={0} title={tooltip ? tooltip(d) : `${label(d)}: ${format(v)}`}>
            <span className="barlist-label">{label(d)}</span>
            <span className="barlist-track">
              <span className="barlist-fill" style={{ width: `${Math.max((v / top) * 100, v ? 1.5 : 0)}%` }} />
            </span>
            <span className="barlist-value">{format(v)}</span>
            {tooltip && <span className="chart-tip" role="tooltip">{tooltip(d)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

// Two-series line chart (created vs resolved per week) with legend, end labels, and a crosshair tooltip.
export function WeeklyLine({ data, series, xLabel }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const W = 720, H = 240, L = 36, R = 74, T = 14, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const maxY = Math.max(...data.flatMap((d) => series.map((s) => d[s.key])), 1);
  const niceMax = Math.ceil(maxY / 10) * 10 || 10;
  const x = (i) => L + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => T + ih - (v / niceMax) * ih;
  const ticks = [0, niceMax / 2, niceMax];

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - L) / iw) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };

  const labelEvery = Math.ceil(data.length / 7);
  const last = data.length - 1;
  // Keep the two end labels from colliding.
  const ends = series.map((s) => ({ ...s, y: y(data[last]?.[s.key] ?? 0) }));
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) {
    const [a, b] = ends[0].y < ends[1].y ? [0, 1] : [1, 0];
    ends[a].y -= 7; ends[b].y += 7;
  }

  return (
    <div className="linechart">
      <div className="legend">
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
      <div className="linechart-box">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart of ${series.map((s) => s.label).join(' and ')} by week`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 8} y={y(t) + 4} className="axis" textAnchor="end">{t}</text>
            </g>
          ))}
          {data.map((d, i) => i % labelEvery === 0 && (
            <text key={d.week} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{xLabel(d)}</text>
          ))}
          {series.map((s) => (
            <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ')} />
          ))}
          {ends.map((s) => (
            <text key={s.key} x={x(last) + 8} y={s.y + 4} className="end-label">{data[last]?.[s.key]} {s.short}</text>
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} className="crosshair" />
              {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
            </g>
          )}
        </svg>
        {hover != null && (
          <div className="chart-tip is-visible" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <strong>Week of {xLabel(data[hover])}</strong>
            {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}: {data[hover][s.key]}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
