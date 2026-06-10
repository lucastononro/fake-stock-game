import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, formatMoney, formatSigned } from "../api/client.js";
import HoldingsTable from "../components/HoldingsTable.jsx";
import QuickSellModal from "../components/QuickSellModal.jsx";
import TradeForm from "../components/TradeForm.jsx";
import ValueChart from "../components/ValueChart.jsx";

const ADVANCE_OPTIONS = [
  { label: "+1 day", amount: 1, unit: "days" },
  { label: "+1 week", amount: 1, unit: "weeks" },
  { label: "+1 month", amount: 1, unit: "months" },
  { label: "+3 months", amount: 3, unit: "months" },
  { label: "+1 year", amount: 12, unit: "months" },
];

const TYPE_LABELS = {
  BUY: "Buy",
  SELL: "Sell",
  INITIAL_DEPOSIT: "Starting cash",
};

export default function SimulationPage() {
  const { simulationId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [chart, setChart] = useState([]);
  const [error, setError] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [sellTarget, setSellTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detailData, transactionData, chartData] = await Promise.all([
        api.getSimulation(simulationId),
        api.simTransactions(simulationId),
        api.simChart(simulationId),
      ]);
      setDetail(detailData);
      setTransactions(transactionData);
      setChart(chartData);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [simulationId]);

  useEffect(() => {
    load();
  }, [load]);

  const getQuote = useCallback((ticker) => api.simQuote(simulationId, ticker), [simulationId]);
  const executeTrade = useCallback(
    (payload) => api.simTrade(simulationId, payload),
    [simulationId]
  );

  async function handleAdvance(option) {
    setAdvancing(true);
    setError(null);
    try {
      await api.simAdvance(simulationId, { amount: option.amount, unit: option.unit });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdvancing(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await api.deleteSimulation(simulationId);
    navigate("/");
  }

  if (error && !detail) {
    return (
      <div className="page">
        <div className="error">{error}</div>
        <Link to="/" className="btn">
          ← Back to dashboard
        </Link>
      </div>
    );
  }
  if (!detail) return <p className="muted">Loading…</p>;

  const { simulation, holdings } = detail;
  const caughtUp = simulation.current_date >= new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <Link to="/" className="back-link muted">
        ← Dashboard
      </Link>

      <header className="page-header">
        <div>
          <h1>
            {simulation.name} <span className="badge badge-time">⏳ Time Machine</span>
          </h1>
          <p className="muted">
            Started {formatDate(simulation.start_date)} with{" "}
            {formatMoney(simulation.initial_cash)}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={handleDelete}>
          {confirmDelete ? "Click again to delete" : "Delete"}
        </button>
      </header>

      <div className="time-banner card">
        <div className="sim-date">
          <span className="muted">Simulated date</span>
          <strong>{formatDate(simulation.current_date)}</strong>
        </div>
        <div className="advance-row">
          {ADVANCE_OPTIONS.map((option) => (
            <button
              key={option.label}
              className="btn"
              disabled={advancing || caughtUp}
              onClick={() => handleAdvance(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {caughtUp && <p className="muted">You've reached today — the simulation is complete.</p>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stats-row">
        <div className="stat card">
          <span className="muted">Total value</span>
          <strong>{formatMoney(detail.total_value)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">Cash available</span>
          <strong>{formatMoney(simulation.cash_balance)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">In stocks</span>
          <strong>{formatMoney(detail.holdings_value)}</strong>
        </div>
        <div className="stat card">
          <span className="muted">Profit</span>
          <strong className={Number(detail.profit) >= 0 ? "gain" : "loss"}>
            {formatSigned(detail.profit)} ({detail.profit_pct}%)
          </strong>
        </div>
      </div>

      <section className="card">
        <h2>Portfolio value over time</h2>
        <ValueChart points={chart} />
      </section>

      <div className="grid-portfolio">
        <section className="card">
          <h2>Holdings</h2>
          {holdings.length === 0 && (
            <div className="empty-state-small">
              <p className="muted">
                No positions yet — buy something at {formatDate(simulation.current_date)} prices,
                then jump forward in time.
              </p>
            </div>
          )}
          <HoldingsTable holdings={holdings} onSell={setSellTarget} />
        </section>

        <section className="card">
          <h2>Trade at {formatDate(simulation.current_date)} prices</h2>
          <TradeForm
            cashBalance={simulation.cash_balance}
            onTraded={load}
            getQuote={getQuote}
            executeTrade={executeTrade}
          />
        </section>
      </div>

      <section className="card">
        <h2>Activity</h2>
        {transactions.length === 0 && <p className="muted">No activity yet.</p>}
        {transactions.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Sim date</th>
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
                  <td className="muted">{formatDate(transaction.sim_date)}</td>
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
