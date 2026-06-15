// src/store/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from "react";

// Demo credentials come from env vars so they aren't shipped in the client
// bundle in plain text. Both must be set or login will always fail.
const CREDENTIALS = {
  username: process.env.REACT_APP_DEMO_USERNAME,
  password: process.env.REACT_APP_DEMO_PASSWORD,
};

const hasCredentials = Boolean(CREDENTIALS.username && CREDENTIALS.password);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on initial load
  useEffect(() => {
    const savedUser = localStorage.getItem('authUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error("Failed to parse saved user:", e);
        localStorage.removeItem('authUser');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (username, password) => {
    if (!hasCredentials) {
      setError("Login is not configured. Set REACT_APP_DEMO_USERNAME and REACT_APP_DEMO_PASSWORD in .env");
      return false;
    }
    if (
      username.trim() === CREDENTIALS.username &&
      password.trim() === CREDENTIALS.password
    ) {
      const userData = { 
        username: username.trim(), 
        name: "Namlo Intern",
        loggedInAt: new Date().toISOString()
      };
      setUser(userData);
      setError("");
      // Save to localStorage
      localStorage.setItem('authUser', JSON.stringify(userData));
      return true;
    }
    setError("Invalid credentials. Use the test account provided.");
    return false;
  };

  // External cleanup hook (set by RideProvider via window.__namlo_onLogout).
  // Avoids a circular import between AuthContext and RideContext.
  const runLogoutCleanup = () => {
    try {
      if (typeof window !== "undefined" && typeof window.__namlo_onLogout === "function") {
        window.__namlo_onLogout();
      }
    } catch (e) {
      console.warn("Logout cleanup hook failed:", e);
    }
  };

  const logout = () => {
    runLogoutCleanup();
    setUser(null);
    setError("");
    // Clear from localStorage
    localStorage.removeItem('authUser');
    // Also clear any other app data if needed
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentRide');
  };

  // Optional: Clear error after timeout
  const clearError = () => {
    setError("");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      error, 
      setError,
      clearError,
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};