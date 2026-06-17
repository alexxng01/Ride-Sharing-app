// src/App.js
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./store/AuthContext";
import { RideProvider } from "./store/RideContext";
import Login from "./components/Auth/Login";
import Dashboard from "./components/Dashboard";
import RiderPanel from "./components/Rider/RiderPanel";
import DriverPanel from "./components/Driver/DriverPanel";
import HistoryPanel from "./components/History/HistoryPanel";
import RideMap from "./components/Map/RideMap"; // Import the map component
import "./index.css";

// ─── Loading Screen ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-dark-400 text-sm tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

// ─── Protected Route ─────────────────────────────────────────────────────────
// Redirects unauthenticated users to /login
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    // Save the page they tried to visit so we can redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ─── Role Guard ──────────────────────────────────────────────────────────────
// Sends users to the right panel based on their role
function RoleRoute({ allowedRole, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // If the user's role doesn't match, redirect to their correct home
  if (user.role && user.role !== allowedRole) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
}

// ─── Public Route ────────────────────────────────────────────────────────────
// Redirects already-logged-in users away from /login
function PublicRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (user) {
    // Send them to their role's home page
    const home = user.role === "driver" ? "/driver" : "/rider";
    return <Navigate to={home} replace />;
  }

  return children;
}

// ─── App Routes ──────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ── Public ── */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* ── Dashboard (shared shell with map) ── */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      >
        {/* Nested: /rider */}
        <Route
          path="rider"
          element={
            <RoleRoute allowedRole="rider">
              <RiderPanel />
            </RoleRoute>
          }
        />

        {/* Nested: /driver */}
        <Route
          path="driver"
          element={
            <RoleRoute allowedRole="driver">
              <DriverPanel />
            </RoleRoute>
          }
        />

        {/* Nested: /history */}
        <Route
          path="history"
          element={
            <ProtectedRoute>
              <HistoryPanel />
            </ProtectedRoute>
          }
        />

        {/* Nested: /map - Show the map with ride tracking */}
        <Route
          path="map"
          element={
            <ProtectedRoute>
              <RideMap />
            </ProtectedRoute>
          }
        />

        {/* Default "/" → redirect to role home */}
        <Route
          index
          element={
            <Navigate
              to={user?.role === "driver" ? "/driver" : "/rider"}
              replace
            />
          }
        />
      </Route>

      {/* ── Catch-all: back to root ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Router>
      <AuthProvider>
        <RideProvider>
          <AppRoutes />
        </RideProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;