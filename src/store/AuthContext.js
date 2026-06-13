// src/store/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from "react";

const CREDENTIALS = {
  username: "intern@namlotech.com",
  password: "namlo2026",
};

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

  const logout = () => {
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