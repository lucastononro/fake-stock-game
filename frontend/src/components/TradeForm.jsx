import { useEffect, useState } from "react";
import { api, formatMoney } from "../api/client.js";
import StockSearch from "./StockSearch.jsx";

export default function TradeForm({ membershipId, onTraded }) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("1");
  const [side, setSide] = useState("buy");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setQuote(null);
    if (!ticker) return;
    let cancelled = false;
    api
      .getQuote(ticker)
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setQuote(null));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const estimated = quote && shares ? Number(quote.price) * Number(shares) : null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.trade(membershipId, { side, ticker, shares });
      setShares("1");
      onTraded?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <StockSearch onSelect={setTicker} />
      <div className="trade-row">
        <label>
          Ticker
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            required
          />
        </label>
        <label>
          Shares
          <input
            type="number"
            min="0.000001"
            step="any"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            required
          />
        </label>
        <label>
          Side
          <select value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
      </div>
      {quote && (
        <p className="muted">
          {quote.ticker} @ {formatMoney(quote.price)}
          {estimated !== null && <> · estimated total {formatMoney(estimated)}</>}
        </p>
      )}
      {error && <div className="error">{error}</div>}
      <button type="submit" className="btn btn-primary" disabled={submitting || !ticker}>
        {submitting ? "Executing…" : side === "buy" ? "Buy" : "Sell"}
      </button>
    </form>
  );
}
