import { formatDate, formatMoney } from "../api/client.js";

const WIDTH = 640;
const HEIGHT = 200;
const PAD = 6;

/** Lightweight SVG line chart for [{date, total_value}] series. */
export default function ValueChart({ points }) {
  if (!points || points.length < 2) {
    return <p className="muted">Advance time to see your portfolio's journey.</p>;
  }

  const values = points.map((p) => Number(p.total_value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((point, index) => {
    const x = PAD + (index / (points.length - 1)) * (WIDTH - PAD * 2);
    const y = PAD + (1 - (Number(point.total_value) - min) / span) * (HEIGHT - PAD * 2);
    return [x, y];
  });
  const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const rising = values[values.length - 1] >= values[0];
  const color = rising ? "var(--gain)" : "var(--loss)";

  return (
    <div className="value-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${PAD},${HEIGHT - PAD} ${path} ${WIDTH - PAD},${HEIGHT - PAD}`}
          fill="url(#chart-fill)"
        />
        <polyline points={path} fill="none" stroke={color} strokeWidth="2" />
      </svg>
      <div className="chart-labels muted">
        <span>
          {formatDate(points[0].date)} · {formatMoney(points[0].total_value)}
        </span>
        <span>
          {formatDate(points[points.length - 1].date)} ·{" "}
          {formatMoney(points[points.length - 1].total_value)}
        </span>
      </div>
    </div>
  );
}
