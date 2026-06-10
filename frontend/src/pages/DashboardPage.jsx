import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney, formatSigned } from "../api/client.js";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function DashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const load = useCallback(() => {
    api.myGroups().then(setGroups).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Hey, {user.display_name} 👋</h1>
          <p className="muted">Your stock game rooms.</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setShowJoin(true)}>
            Join with code
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create group
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {groups === null && !error && <p className="muted">Loading your groups…</p>}

      {groups?.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🏟️</span>
          <h2>No groups yet</h2>
          <p className="muted">
            Create a group and share its invite code with friends, or join one with a code you
            received.
          </p>
          <div className="header-actions">
            <button className="btn" onClick={() => setShowJoin(true)}>
              Join with code
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create group
            </button>
          </div>
        </div>
      )}

      <div className="group-grid">
        {groups?.map((summary) => (
          <Link
            to={`/groups/${summary.group.id}`}
            key={summary.group.id}
            className="group-card"
          >
            <div className="group-card-top">
              <h3>{summary.group.name}</h3>
              {summary.is_owner && <span className="badge">Owner</span>}
            </div>
            <div className="group-card-value">
              <span className="muted">Your portfolio</span>
              <strong>{formatMoney(summary.total_value)}</strong>
              <span className={Number(summary.profit) >= 0 ? "gain" : "loss"}>
                {formatSigned(summary.profit)}
              </span>
            </div>
            <div className="group-card-footer muted">
              <span>
                Rank #{summary.rank} of {summary.group.member_count}
              </span>
              <span>{formatMoney(summary.cash_balance)} cash</span>
            </div>
          </Link>
        ))}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onDone={load} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} onDone={load} />}
    </div>
  );
}

function CreateGroupModal({ onClose, onDone }) {
  const [form, setForm] = useState({
    name: "",
    initial_cash: "10000",
    monthly_allowance: "1000",
    password: "",
  });
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    try {
      const group = await api.createGroup({
        name: form.name.trim(),
        initial_cash: form.initial_cash,
        monthly_allowance: form.monthly_allowance,
        password: form.password || null,
      });
      setCreated(group);
      onDone();
    } catch (e) {
      setError(e.message);
    }
  }

  if (created) {
    return (
      <Modal title="Group created 🎉" onClose={onClose}>
        <p>
          <strong>{created.name}</strong> is ready. Share this invite code with your friends:
        </p>
        <div className="invite-highlight">
          <code>{created.invite_code}</code>
        </div>
        {created.has_password && (
          <p className="muted">They'll also need the group password you set.</p>
        )}
        <Link to={`/groups/${created.id}`} className="btn btn-primary btn-block" onClick={onClose}>
          Go to group
        </Link>
      </Modal>
    );
  }

  return (
    <Modal title="Create a group" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Group name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Wolves of Wall St"
            required
            minLength={2}
            autoFocus
          />
        </label>
        <div className="form-row">
          <label>
            Starting cash ($)
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
        </div>
        <label>
          Group password <span className="muted">(optional)</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Leave empty for no password"
            minLength={form.password ? 4 : 0}
          />
        </label>
        <p className="hint muted">
          Everyone who joins starts with the same cash and receives the allowance every month.
        </p>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block">
          Create group
        </button>
      </form>
    </Modal>
  );
}

function JoinGroupModal({ onClose, onDone }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(null);

  async function handleLookup(event) {
    event.preventDefault();
    setError(null);
    try {
      setPreview(await api.lookupGroup(code.trim()));
    } catch (e) {
      setPreview(null);
      setError(e.message);
    }
  }

  async function handleJoin() {
    setError(null);
    try {
      const membership = await api.joinGroup({
        invite_code: code.trim(),
        password: password || null,
      });
      setJoined(membership);
      onDone();
    } catch (e) {
      setError(e.message);
    }
  }

  if (joined) {
    return (
      <Modal title="You're in! 🎉" onClose={onClose}>
        <p>
          Welcome to <strong>{preview.name}</strong>. Your wallet starts with{" "}
          <strong>{formatMoney(preview.initial_cash)}</strong>.
        </p>
        <Link
          to={`/groups/${joined.group_id}`}
          className="btn btn-primary btn-block"
          onClick={onClose}
        >
          Go to group
        </Link>
      </Modal>
    );
  }

  return (
    <Modal title="Join a group" onClose={onClose}>
      <form onSubmit={handleLookup} className="form">
        <label>
          Invite code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="KX7M2APQ"
            required
            autoFocus
            className="input-code"
          />
        </label>
        {!preview && (
          <button type="submit" className="btn btn-block">
            Find group
          </button>
        )}
      </form>

      {preview && (
        <div className="join-preview">
          <h3>{preview.name}</h3>
          <p className="muted">
            {preview.member_count} member{preview.member_count === 1 ? "" : "s"} · starts with{" "}
            {formatMoney(preview.initial_cash)} · {formatMoney(preview.monthly_allowance)}/month
          </p>
          {preview.already_member ? (
            <p className="muted">You're already in this group.</p>
          ) : (
            <>
              {preview.requires_password && (
                <label className="form">
                  Group password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ask the group owner"
                  />
                </label>
              )}
              <button className="btn btn-primary btn-block" onClick={handleJoin}>
                Join group
              </button>
            </>
          )}
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </Modal>
  );
}
