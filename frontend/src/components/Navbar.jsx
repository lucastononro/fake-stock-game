import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">📈</span> Fake Stock Game
      </Link>
      <div className="navbar-user">
        {user.picture ? (
          <img className="avatar avatar-img" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar">{user.display_name.charAt(0).toUpperCase()}</span>
        )}
        <span className="navbar-username">{user.display_name}</span>
        <button className="btn btn-ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
