import { formatMoney } from "../api/client.js";
import { SERIES_COLORS, tickerColor } from "./chartColors.js";

const RADIUS = 60;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Donut of the wallet's current composition: cash + each position. */
export default function AllocationDonut({ cash, holdings }) {
  const tickers = holdings.map((h) => h.ticker).sort();
  const segments = [
    { label: "Cash", value: Number(cash), color: SERIES_COLORS.cash },
    ...holdings
      .filter((h) => h.market_value !== null)
      .map((h) => ({
        label: h.ticker,
        value: Number(h.market_value),
        color: tickerColor(h.ticker, tickers),
      })),
  ].filter((s) => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return <p className="muted">Nothing in this wallet yet.</p>;

  let cumulative = 0;
  const arcs = segments.map((segment) => {
    const fraction = segment.value / total;
    const arc = { ...segment, fraction, offset: cumulative };
    cumulative += fraction;
    return arc;
  });

  return (
    <div className="donut-layout">
      <svg viewBox="0 0 160 160" className="donut">
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={-arc.offset * CIRCUMFERENCE}
            transform="rotate(-90 80 80)"
          />
        ))}
      </svg>
      <ul className="donut-legend">
        {arcs.map((arc) => (
          <li key={arc.label}>
            <span className="legend-dot" style={{ background: arc.color }} />
            <span className="donut-label">{arc.label}</span>
            <span className="muted">{(arc.fraction * 100).toFixed(1)}%</span>
            <strong>{formatMoney(arc.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
