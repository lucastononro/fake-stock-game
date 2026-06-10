import { useEffect, useState } from "react";
import { formatMoney } from "../api/client.js";
import StockSearch from "./StockSearch.jsx";

/**
 * Buy/sell panel. Market access is injected so it works for both live
 * portfolios and Time Machine simulations:
 *   getQuote(ticker) -> {ticker, price}
 *   executeTrade({side, ticker, shares}) -> transaction
 */
export default function TradeForm({ cashBalance, onTraded, getQuote, executeTrade }) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("1");
  const [side, setSide] = useState("buy");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setQuote(null);
    if (!ticker) return;
    let cancelled = false;
    getQuote(ticker)
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setQuote(null));
    return () => {
      cancelled = true;
    };
  }, [ticker, getQuote]);

  const estimated = quote && shares ? Number(quote.price) * Number(shares) : null;
  const cantAfford = side === "buy" && estimated !== null && estimated > Number(cashBalance);

  function setMaxAffordable() {
    if (!quote) return;
    const max = Math.floor((Number(cashBalance) / Number(quote.price)) * 10000) / 10000;
    setShares(String(max));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const trade = await executeTrade({ side, ticker, shares });
      setSuccess(
        `${side === "buy" ? "Bought" : "Sold"} ${Number(trade.shares)} ${trade.ticker} @ ${formatMoney(trade.price)}`
      );
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
      <div className="segmented">
        <button
          type="button"
          className={side === "buy" ? "segment active segment-buy" : "segment"}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={side === "sell" ? "segment active segment-sell" : "segment"}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

      <StockSearch onSelect={setTicker} />

      <div className="form-row">
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
          <span className="label-with-action">
            Shares
            {side === "buy" && quote && (
              <button type="button" className="link-button" onClick={setMaxAffordable}>
                Max
              </button>
            )}
          </span>
          <input
            type="number"
            min="0.000001"
            step="any"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            required
          />
        </label>
      </div>

      {quote && (
        <p className="quote-line muted">
          {quote.ticker} @ {formatMoney(quote.price)}
          {quote.date && <> on {quote.date}</>}
          {estimated !== null && (
            <>
              {" "}
              · total <strong className={cantAfford ? "loss" : ""}>{formatMoney(estimated)}</strong>
              {cantAfford && " (not enough cash)"}
            </>
          )}
        </p>
      )}

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <button
        type="submit"
        className={`btn btn-block ${side === "buy" ? "btn-buy" : "btn-sell"}`}
        disabled={submitting || !ticker || cantAfford}
      >
        {submitting ? "Executing…" : side === "buy" ? `Buy ${ticker || "…"}` : `Sell ${ticker || "…"}`}
      </button>
    </form>
  );
}
