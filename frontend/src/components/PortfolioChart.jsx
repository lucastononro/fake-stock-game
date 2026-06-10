import { useMemo, useState } from "react";
import { SERIES_COLORS, tickerColor } from "./chartColors.js";
import MultiLineChart from "./MultiLineChart.jsx";

const RANGES = [
  { key: "1W", days: 7 },
  { key: "1M", days: 31 },
  { key: "3M", days: 92 },
  { key: "6M", days: 183 },
  { key: "1Y", days: 366 },
  { key: "All", days: null },
];

/**
 * Filterable performance chart over rich ChartPoints:
 * toggle Total / Cash / Stocks / individual tickers, pick a time range.
 */
export default function PortfolioChart({ points, emptyMessage }) {
  const [rangeKey, setRangeKey] = useState("All");
  const [active, setActive] = useState(() => new Set(["total"]));

  const tickers = useMemo(() => {
    const set = new Set();
    points?.forEach((p) => Object.keys(p.by_ticker).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [points]);

  const visiblePoints = useMemo(() => {
    if (!points) return [];
    const range = RANGES.find((r) => r.key === rangeKey);
    if (!range?.days) return points;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const sliced = points.filter((p) => p.date >= cutoffIso);
    return sliced.length >= 2 ? sliced : points;
  }, [points, rangeKey]);

  if (!points || points.length < 2) {
    return <p className="muted">{emptyMessage}</p>;
  }

  const seriesDefs = [
    { key: "total", label: "Total", color: SERIES_COLORS.total, pick: (p) => p.total_value },
    { key: "cash", label: "Cash", color: SERIES_COLORS.cash, pick: (p) => p.cash },
    { key: "stocks", label: "Stocks", color: SERIES_COLORS.stocks, pick: (p) => p.stocks_value },
    ...tickers.map((ticker) => ({
      key: `ticker:${ticker}`,
      label: ticker,
      color: tickerColor(ticker, tickers),
      pick: (p) => p.by_ticker[ticker] ?? 0,
    })),
  ];

  function toggle(key) {
    setActive((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one line
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const activeSeries = seriesDefs
    .filter((def) => active.has(def.key))
    .map((def) => ({
      key: def.key,
      label: def.label,
      color: def.color,
      values: visiblePoints.map((p) => Number(def.pick(p))),
    }));

  return (
    <div>
      <div className="chart-controls">
        <div className="chip-row">
          {seriesDefs.map((def) => (
            <button
              key={def.key}
              className={`chip ${active.has(def.key) ? "chip-active" : ""}`}
              style={active.has(def.key) ? { borderColor: def.color } : undefined}
              onClick={() => toggle(def.key)}
            >
              <span className="legend-dot" style={{ background: def.color }} />
              {def.label}
            </button>
          ))}
        </div>
        <div className="range-row">
          {RANGES.map((range) => (
            <button
              key={range.key}
              className={`chip ${rangeKey === range.key ? "chip-active" : ""}`}
              onClick={() => setRangeKey(range.key)}
            >
              {range.key}
            </button>
          ))}
        </div>
      </div>
      <MultiLineChart dates={visiblePoints.map((p) => p.date)} series={activeSeries} />
    </div>
  );
}
