export const SERIES_COLORS = {
  total: "#6366f1",
  cash: "#22d3ee",
  stocks: "#a78bfa",
};

const TICKER_PALETTE = [
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#f472b6",
  "#60a5fa",
  "#4ade80",
  "#facc15",
  "#fb923c",
  "#2dd4bf",
  "#c084fc",
];

/** Stable color per ticker, given the sorted list of all tickers in play. */
export function tickerColor(ticker, allTickers) {
  const index = allTickers.indexOf(ticker);
  return TICKER_PALETTE[(index >= 0 ? index : 0) % TICKER_PALETTE.length];
}
