import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatMoney, formatSigned } from "../api/client.js";
import AllocationDonut from "../components/AllocationDonut.jsx";
import HoldingsTable from "../components/HoldingsTable.jsx";
import PortfolioChart from "../components/PortfolioChart.jsx";
import QuickSellModal from "../components/QuickSellModal.jsx";
import TradeForm from "../components/TradeForm.jsx";

const TYPE_LABELS = {
  BUY: "Buy",
  SELL: "Sell",
  INITIAL_DEPOSIT: "Starting cash",
  ALLOWANCE: "Monthly allowance",
};

export default function PortfolioPage() {
  const { membershipId } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const [portfolioData, transactionData, chartData] = await Promise.all([
        api.getPortfolio(membershipId),
        api.listTransactions(membershipId),
        api.getPortfolioChart(membershipId),
      ]);
      setPortfolio(portfolioData);
      setTransactions(transactionData);
      setChart(chartData);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [membershipId]);

  useEffect(() => {
    load();
  }, [load]);

  const getQuote = useCallback((ticker) => api.getQuote(ticker), []);
  const executeTrade = useCallback(
    (payload) => api.trade(membershipId, payload),
    [membershipId]
  );

  if (error && !portfolio) {
    return (
      <div className="page">
        <div className="error">{error}</div>
        <Link to="/" className="btn">
          ← Back to dashboard
        </Link>
      </div>
    );
  }
  if (!portfolio) return <p className="muted">Loading…</p>;

  const { user, group, membership, holdings, is_mine } = portfolio;

  return (
    <div className="page">
      <Link to={`/groups/${group.id}`} className="back-link muted">
        ← {group.name}
      </Link>

      <header className="page-header">
        <div>
          <h1>{is_mine ? "My portfolio" : `${user.display_name}'s portfolio`}</h1>
          <p className="muted">
            in <Link to={`/groups/${group.id}`}>{group.name}</Link>
          </p>
        </div>
      </header>

      <div className="stats-row">
        <div className="stat card">
          <span className="muted">Total value</span>
          <strong>{formatMoney(portfolio.total_value)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">Cash available</span>
          <strong>{formatMoney(membership.cash_balance)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">In stocks</span>
          <strong>{formatMoney(portfolio.holdings_value)}</strong>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid-portfolio">
        <section className="card">
          <h2>Performance</h2>
          <PortfolioChart
            points={chart}
            emptyMessage="The performance chart appears after your first day in the group — check back tomorrow."
          />
        </section>
        <section className="card">
          <h2>Allocation</h2>
          <AllocationDonut cash={membership.cash_balance} holdings={holdings} />
        </section>
      </div>

      <div className={is_mine ? "grid-portfolio" : ""}>
        <section className="card">
          <h2>Holdings</h2>
          {holdings.length === 0 && (
            <div className="empty-state-small">
              <p className="muted">
                {is_mine
                  ? "No positions yet — search a stock on the right and make your first trade."
                  : "No positions yet."}
              </p>
            </div>
          )}
          <HoldingsTable holdings={holdings} onSell={is_mine ? setSellTarget : undefined} />
        </section>

        {is_mine && (
          <section className="card">
            <h2>Trade</h2>
            <TradeForm
              cashBalance={membership.cash_balance}
              onTraded={load}
              getQuote={getQuote}
              executeTrade={executeTrade}
            />
          </section>
        )}
      </div>

      <section className="card">
        <h2>Activity</h2>
        {transactions.length === 0 && <p className="muted">No activity yet.</p>}
        {transactions.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Ticker</th>
                <th className="num">Shares</th>
                <th className="num">Price</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="muted">
                    {new Date(transaction.created_at).toLocaleDateString()}{" "}
                    {new Date(transaction.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{TYPE_LABELS[transaction.type] || transaction.type}</td>
                  <td>{transaction.ticker || "—"}</td>
                  <td className="num">
                    {transaction.shares ? Number(transaction.shares) : "—"}
                  </td>
                  <td className="num">
                    {transaction.price ? formatMoney(transaction.price) : "—"}
                  </td>
                  <td className={`num ${Number(transaction.amount) >= 0 ? "gain" : "loss"}`}>
                    {formatSigned(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sellTarget && (
        <QuickSellModal
          holding={sellTarget}
          executeTrade={executeTrade}
          onClose={() => setSellTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
