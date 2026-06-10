import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatMoney } from "../api/client.js";
import { useCurrentUser } from "../context/CurrentUserContext.jsx";

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useCurrentUser();

  const load = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const myEntry = leaderboard.find((entry) => entry.user.id === currentUser?.id);

  async function handleJoin() {
    setError(null);
    try {
      await api.joinGroup(groupId, { user_id: currentUser.id });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading && !group) return <p className="muted">Loading…</p>;
  if (error && !group) return <div className="error">{error}</div>;

  return (
    <div className="page">
      <h1>{group.name}</h1>
      <p className="muted">
        Starting cash {formatMoney(group.initial_cash)} · allowance{" "}
        {formatMoney(group.monthly_allowance)}/month · invite code{" "}
        <code>{group.invite_code}</code>
      </p>
      {error && <div className="error">{error}</div>}

      {currentUser && !myEntry && (
        <button className="btn btn-primary" onClick={handleJoin}>
          Join this group as {currentUser.display_name}
        </button>
      )}
      {myEntry && (
        <Link className="btn btn-primary" to={`/portfolio/${myEntry.membership_id}`}>
          Open my portfolio
        </Link>
      )}
      {!currentUser && <p className="muted">Select a player to join this group.</p>}

      <section className="card">
        <h2>Leaderboard</h2>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Cash</th>
              <th>Stocks</th>
              <th>Total</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr key={entry.membership_id} className={entry.user.id === currentUser?.id ? "row-me" : ""}>
                <td>{index + 1}</td>
                <td>
                  <Link to={`/portfolio/${entry.membership_id}`}>{entry.user.display_name}</Link>
                </td>
                <td>{formatMoney(entry.cash_balance)}</td>
                <td>{formatMoney(entry.holdings_value)}</td>
                <td>
                  <strong>{formatMoney(entry.total_value)}</strong>
                </td>
                <td className={Number(entry.profit) >= 0 ? "gain" : "loss"}>
                  {formatMoney(entry.profit)} ({entry.profit_pct}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
