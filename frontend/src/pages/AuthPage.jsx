import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const CLIENT_ID_CONFIGURED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function AuthPage() {
  const [error, setError] = useState(null);
  const { login } = useAuth();

  async function handleGoogleSuccess(response) {
    setError(null);
    try {
      const auth = await api.googleAuth({ credential: response.credential });
      login(auth);
    } catch (e) {
      setError(e.message);
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

        {CLIENT_ID_CONFIGURED ? (
          <div className="google-login">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in failed — please try again")}
              theme="filled_black"
              size="large"
              shape="pill"
              text="continue_with"
            />
          </div>
        ) : (
          <div className="error">
            Google sign-in isn't configured yet. Create a web OAuth client ID in Google Cloud
            Console (authorized origin <code>http://localhost:5173</code>), put it in a{" "}
            <code>.env</code> file as <code>GOOGLE_CLIENT_ID=…</code>, then restart{" "}
            <code>docker compose</code>.
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
