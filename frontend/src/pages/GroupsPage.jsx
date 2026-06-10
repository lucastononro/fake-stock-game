import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatMoney } from "../api/client.js";
import { useCurrentUser } from "../context/CurrentUserContext.jsx";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ name: "", initial_cash: "10000", monthly_allowance: "1000" });
  const [error, setError] = useState(null);
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    api.listGroups().then(setGroups).catch((e) => setError(e.message));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    if (!currentUser) {
      setError("Select a player first (Players tab).");
      return;
    }
    try {
      const group = await api.createGroup({
        name: form.name.trim(),
        owner_id: currentUser.id,
        initial_cash: form.initial_cash,
        monthly_allowance: form.monthly_allowance,
      });
      navigate(`/groups/${group.id}`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <h1>Groups</h1>
      <p className="muted">
        Create a stock game with friends: everyone starts with the same fake cash and gets a
        monthly allowance.
      </p>
      {error && <div className="error">{error}</div>}

      <div className="grid-two">
        <section className="card">
          <h2>All groups</h2>
          {groups.length === 0 && <p className="muted">No groups yet — create the first one!</p>}
          <ul className="list">
            {groups.map((group) => (
              <li key={group.id} className="list-item">
                <span>
                  <Link to={`/groups/${group.id}`}>
                    <strong>{group.name}</strong>
                  </Link>
                  <br />
                  <span className="muted">
                    {group.member_count} member{group.member_count === 1 ? "" : "s"} · start{" "}
                    {formatMoney(group.initial_cash)} · {formatMoney(group.monthly_allowance)}/mo
                  </span>
                </span>
                <Link className="btn" to={`/groups/${group.id}`}>
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>New group</h2>
          <form onSubmit={handleCreate} className="form">
            <label>
              Group name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Wolves of Wall St"
                required
                minLength={2}
              />
            </label>
            <label>
              Initial cash ($)
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.initial_cash}
                onChange={(e) => setForm({ ...form, initial_cash: e.target.value })}
                required
              />
            </label>
            <label>
              Monthly allowance ($)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_allowance}
                onChange={(e) => setForm({ ...form, monthly_allowance: e.target.value })}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Create group
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
