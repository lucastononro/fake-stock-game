import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", display_name: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const isLogin = mode === "login";

  function set(field) {
    return (event) => setForm({ ...form, [field]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth = isLogin
        ? await api.login({ username: form.username.trim(), password: form.password })
        : await api.register({
            username: form.username.trim(),
            display_name: form.display_name.trim() || form.username.trim(),
            password: form.password,
          });
      login(auth);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">📈</span>
          <h1>Fake Stock Game</h1>
          <p className="muted">
            Trade real stocks with fake money. Compete with friends. Zero risk, full bragging
            rights.
          </p>
        </div>

        <div className="segmented">
          <button
            className={isLogin ? "segment active" : "segment"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            className={!isLogin ? "segment active" : "segment"}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Username
            <input
              value={form.username}
              onChange={set("username")}
              placeholder="warren_b"
              required
              minLength={2}
              autoFocus
            />
          </label>
          {!isLogin && (
            <label>
              Display name
              <input
                value={form.display_name}
                onChange={set("display_name")}
                placeholder="Warren Buffett"
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              placeholder={isLogin ? "Your password" : "At least 6 characters"}
              required
              minLength={isLogin ? 1 : 6}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "One sec…" : isLogin ? "Sign in" : "Create account & play"}
          </button>
        </form>
      </div>
    </div>
  );
}
