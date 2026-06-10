import { formatMoney, formatSigned } from "../api/client.js";

/** Holdings table. Pass `onSell(holding)` to show a Sell button per row. */
export default function HoldingsTable({ holdings, onSell }) {
  if (holdings.length === 0) return null;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th className="num">Shares</th>
          <th className="num">Avg cost</th>
          <th className="num">Price</th>
          <th className="num">Value</th>
          <th className="num">P&L</th>
          {onSell && <th></th>}
        </tr>
      </thead>
      <tbody>
        {holdings.map((holding) => {
          const pnl =
            holding.market_value !== null
              ? Number(holding.market_value) - Number(holding.cost_basis)
              : null;
          return (
            <tr key={holding.ticker}>
              <td>
                <strong>{holding.ticker}</strong>
              </td>
              <td className="num">{Number(holding.shares)}</td>
              <td className="num">{formatMoney(holding.avg_cost)}</td>
              <td className="num">{formatMoney(holding.current_price)}</td>
              <td className="num">{formatMoney(holding.market_value)}</td>
              <td className={`num ${pnl === null ? "" : pnl >= 0 ? "gain" : "loss"}`}>
                {pnl === null ? "—" : formatSigned(pnl)}
              </td>
              {onSell && (
                <td className="num">
                  <button className="btn btn-sell btn-small" onClick={() => onSell(holding)}>
                    Sell
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
