import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatMoney } from "../api/client.js";
import TradeForm from "../components/TradeForm.jsx";

export default function PortfolioPage() {
  const { membershipId } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [portfolioData, transactionData] = await Promise.all([
        api.getPortfolio(membershipId),
        api.listTransactions(membershipId),
      ]);
      setPortfolio(portfolioData);
      setTransactions(transactionData);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [membershipId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !portfolio) return <div className="error">{error}</div>;
  if (!portfolio) return <p className="muted">Loading…</p>;

  const { user, group, membership, holdings } = portfolio;

  return (
    <div className="page">
      <h1>
        {user.display_name}'s portfolio{" "}
        <span className="muted">
          in <Link to={`/groups/${group.id}`}>{group.name}</Link>
        </span>
      </h1>

      <div className="stats-row">
        <div className="stat card">
          <span className="muted">Total value</span>
          <strong>{formatMoney(portfolio.total_value)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">Cash</span>
          <strong>{formatMoney(membership.cash_balance)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">Stocks</span>
          <strong>{formatMoney(portfolio.holdings_value)}</strong>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid-two">
        <section className="card">
          <h2>Holdings</h2>
          {holdings.length === 0 && <p className="muted">No positions yet — buy something!</p>}
          {holdings.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Shares</th>
                  <th>Avg cost</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>P&L</th>
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
                      <td>{Number(holding.shares)}</td>
                      <td>{formatMoney(holding.avg_cost)}</td>
                      <td>{formatMoney(holding.current_price)}</td>
                      <td>{formatMoney(holding.market_value)}</td>
                      <td className={pnl === null ? "" : pnl >= 0 ? "gain" : "loss"}>
                        {pnl === null ? "—" : formatMoney(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Trade</h2>
          <TradeForm membershipId={membershipId} onTraded={load} />
        </section>
      </div>

      <section className="card">
        <h2>Transactions</h2>
        {transactions.length === 0 && <p className="muted">No transactions yet.</p>}
        {transactions.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Ticker</th>
                <th>Shares</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{new Date(transaction.created_at).toLocaleString()}</td>
                  <td>{transaction.type}</td>
                  <td>{transaction.ticker || "—"}</td>
                  <td>{transaction.shares ? Number(transaction.shares) : "—"}</td>
                  <td>{transaction.price ? formatMoney(transaction.price) : "—"}</td>
                  <td className={Number(transaction.amount) >= 0 ? "gain" : "loss"}>
                    {formatMoney(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
