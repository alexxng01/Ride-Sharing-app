// src/App.js
import React from "react";
import { AuthProvider, useAuth } from "./store/AuthContext";
import { RideProvider }          from "./store/RideContext";
import Login                     from "./components/Auth/Login";
import Dashboard                 from "./components/Dashboard";
import "./index.css";


function AppContent() {
  const { user, isLoading } = useAuth();
  
  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  // If no user is logged in, show login page
  if (!user) {
    return <Login />;
  }
  
  // If user is logged in, show dashboard
  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <RideProvider>
        <AppContent />
      </RideProvider>
    </AuthProvider>
  );
}

export default App;