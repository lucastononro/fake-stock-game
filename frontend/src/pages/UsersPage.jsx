import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useCurrentUser } from "../context/CurrentUserContext.jsx";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const { currentUser, setCurrentUser } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    api.listUsers().then(setUsers).catch((e) => setError(e.message));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    try {
      const user = await api.createUser({
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
      });
      setUsers((prev) => [...prev, user]);
      setCurrentUser(user);
      setUsername("");
      setDisplayName("");
      navigate("/groups");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <h1>Players</h1>
      <p className="muted">Pick who you are, or create a new player. (No login yet — honor system!)</p>
      {error && <div className="error">{error}</div>}

      <div className="grid-two">
        <section className="card">
          <h2>Existing players</h2>
          {users.length === 0 && <p className="muted">No players yet.</p>}
          <ul className="list">
            {users.map((user) => (
              <li key={user.id} className="list-item">
                <span>
                  <strong>{user.display_name}</strong>{" "}
                  <span className="muted">@{user.username}</span>
                </span>
                <button
                  className={currentUser?.id === user.id ? "btn btn-active" : "btn"}
                  onClick={() => setCurrentUser(user)}
                >
                  {currentUser?.id === user.id ? "Selected" : "Play as"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>New player</h2>
          <form onSubmit={handleCreate} className="form">
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="warren_b"
                required
                minLength={2}
              />
            </label>
            <label>
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Warren Buffett"
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Create player
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
