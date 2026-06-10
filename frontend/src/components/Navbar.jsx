import { Link, NavLink } from "react-router-dom";
import { useCurrentUser } from "../context/CurrentUserContext.jsx";

export default function Navbar() {
  const { currentUser } = useCurrentUser();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        📈 Fake Stock Game
      </Link>
      <div className="navbar-links">
        <NavLink to="/users">Players</NavLink>
        <NavLink to="/groups">Groups</NavLink>
      </div>
      <div className="navbar-user">
        {currentUser ? (
          <span>
            Playing as <strong>{currentUser.display_name}</strong>
          </span>
        ) : (
          <span className="muted">No player selected</span>
        )}
      </div>
    </nav>
  );
}
