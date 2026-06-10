import { useRef, useState } from "react";
import { formatDate, formatMoney } from "../api/client.js";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = 8;

/**
 * SVG line chart with multiple series and a hover tooltip.
 * props: dates: string[], series: [{key, label, color, values: number[]}]
 */
export default function MultiLineChart({ dates, series }) {
  const containerRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const count = dates.length;
  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;

  const x = (index) => PAD + (index / (count - 1)) * (WIDTH - PAD * 2);
  const y = (value) => PAD + (1 - (value - min) / span) * (HEIGHT - PAD * 2);

  function handleMouseMove(event) {
    const rect = containerRef.current.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const index = Math.round(fraction * (count - 1));
    setHoverIndex(Math.max(0, Math.min(count - 1, index)));
  }

  const tooltipLeftPct = hoverIndex !== null ? (hoverIndex / (count - 1)) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="value-chart"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        {series.map((line) => (
          <polyline
            key={line.key}
            points={line.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={line.color}
            strokeWidth="2"
          />
        ))}
        {hoverIndex !== null && (
          <>
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PAD}
              y2={HEIGHT - PAD}
              stroke="rgba(139, 147, 167, 0.4)"
              strokeWidth="1"
            />
            {series.map((line) => (
              <circle
                key={line.key}
                cx={x(hoverIndex)}
                cy={y(line.values[hoverIndex])}
                r="3.5"
                fill={line.color}
              />
            ))}
          </>
        )}
      </svg>

      {hoverIndex !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${tooltipLeftPct}%`,
            transform: `translateX(${tooltipLeftPct > 70 ? "-105%" : "5%"})`,
          }}
        >
          <div className="chart-tooltip-date">{formatDate(dates[hoverIndex])}</div>
          {series.map((line) => (
            <div key={line.key} className="chart-tooltip-row">
              <span className="legend-dot" style={{ background: line.color }} />
              {line.label}
              <strong>{formatMoney(line.values[hoverIndex])}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="chart-labels muted">
        <span>{formatDate(dates[0])}</span>
        <span>{formatDate(dates[count - 1])}</span>
      </div>
    </div>
  );
}
