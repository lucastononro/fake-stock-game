import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatMoney, formatSigned } from "../api/client.js";
import InviteCode from "../components/InviteCode.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [groupData, leaderboardData] = await Promise.all([
        api.getGroup(groupId),
        api.getLeaderboard(groupId),
      ]);
      setGroup(groupData);
      setLeaderboard(leaderboardData);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !group) {
    return (
      <div className="page">
        <div className="error">{error}</div>
        <Link to="/" className="btn">
          ← Back to dashboard
        </Link>
      </div>
    );
  }
  if (!group) return <p className="muted">Loading…</p>;

  const myEntry = leaderboard.find((entry) => entry.user.id === user.id);

  return (
    <div className="page">
      <Link to="/" className="back-link muted">
        ← Dashboard
      </Link>

      <header className="page-header">
        <div>
          <h1>{group.name}</h1>
          <p className="muted">
            {group.member_count} member{group.member_count === 1 ? "" : "s"} · everyone starts
            with {formatMoney(group.initial_cash)} ·{" "}
            {Number(group.monthly_allowance) > 0
              ? `${formatMoney(group.monthly_allowance)} allowance/month`
              : "no monthly allowance"}
            {group.has_password && " · 🔒 password protected"}
          </p>
        </div>
        <div className="header-actions">
          {myEntry && (
            <Link to={`/portfolio/${myEntry.membership_id}`} className="btn btn-primary">
              My portfolio
            </Link>
          )}
        </div>
      </header>

      <div className="invite-banner card">
        <div>
          <strong>Invite friends</strong>
          <p className="muted">Share this code — they join from their dashboard.</p>
        </div>
        <InviteCode code={group.invite_code} />
      </div>

      <section className="card">
        <h2>Leaderboard</h2>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Player</th>
              <th className="num">Cash</th>
              <th className="num">Stocks</th>
              <th className="num">Total</th>
              <th className="num">P&L</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr
                key={entry.membership_id}
                className={entry.user.id === user.id ? "row-me" : ""}
              >
                <td className="rank">{MEDALS[index] || `#${index + 1}`}</td>
                <td>
                  <Link to={`/portfolio/${entry.membership_id}`}>
                    {entry.user.display_name}
                    {entry.user.id === user.id && <span className="muted"> (you)</span>}
                  </Link>
                </td>
                <td className="num">{formatMoney(entry.cash_balance)}</td>
                <td className="num">{formatMoney(entry.holdings_value)}</td>
                <td className="num">
                  <strong>{formatMoney(entry.total_value)}</strong>
                </td>
                <td className={`num ${Number(entry.profit) >= 0 ? "gain" : "loss"}`}>
                  {formatSigned(entry.profit)} ({entry.profit_pct}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
