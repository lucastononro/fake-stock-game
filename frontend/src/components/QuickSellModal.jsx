import { useState } from "react";
import { formatMoney } from "../api/client.js";
import Modal from "./Modal.jsx";

/** One-click sell from a holdings row: prefilled with the whole position. */
export default function QuickSellModal({ holding, executeTrade, onClose, onDone }) {
  const [shares, setShares] = useState(String(Number(holding.shares)));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const allShares = Number(holding.shares);
  const price = holding.current_price !== null ? Number(holding.current_price) : null;
  const proceeds = price !== null && shares ? price * Number(shares) : null;

  async function handleSell() {
    setError(null);
    setSubmitting(true);
    try {
      await executeTrade({ side: "sell", ticker: holding.ticker, shares });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Sell ${holding.ticker}`} onClose={onClose}>
      <div className="form">
        <p className="muted">
          You hold <strong>{allShares}</strong> share{allShares === 1 ? "" : "s"}
          {price !== null && <> · current price {formatMoney(price)}</>}
        </p>
        <label>
          <span className="label-with-action">
            Shares to sell
            <button
              type="button"
              className="link-button"
              onClick={() => setShares(String(allShares))}
            >
              Sell all
            </button>
          </span>
          <input
            type="number"
            min="0.000001"
            max={allShares}
            step="any"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            autoFocus
          />
        </label>
        {proceeds !== null && (
          <p className="quote-line muted">
            You'll receive <strong className="gain">{formatMoney(proceeds)}</strong>
          </p>
        )}
        {error && <div className="error">{error}</div>}
        <button
          className="btn btn-sell btn-block"
          onClick={handleSell}
          disabled={submitting || !shares || Number(shares) <= 0 || Number(shares) > allShares}
        >
          {submitting ? "Selling…" : `Sell ${shares || "…"} ${holding.ticker}`}
        </button>
      </div>
    </Modal>
  );
}
