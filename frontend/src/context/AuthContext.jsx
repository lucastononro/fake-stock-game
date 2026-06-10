import { createContext, useContext, useState } from "react";
import { clearSession, getStoredUser, storeSession } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  function login(authResponse) {
    storeSession(authResponse.token, authResponse.user);
    setUser(authResponse.user);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
