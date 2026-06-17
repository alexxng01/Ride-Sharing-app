// src/components/Auth/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../../store/AuthContext";
import { motion } from "framer-motion";
import { Car, Eye, EyeOff, Loader } from "lucide-react";

export default function Login() {
  const { login, error, setError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    login(username.trim(), password.trim());
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-900/20 rounded-full blur-3xl animate-pulse-slow"
          style={{ animationDelay: "1.5s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-900/10 rounded-full blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(249,115,22,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.3) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700/50 rounded-3xl p-8 shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-16 h-16 bg-gradient-to-br from-brand-500 to-orange-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-500/30"
            >
              <Car className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">
              Namlo<span className="text-brand-500">Rides</span>
            </h1>
            <p className="text-dark-400 text-sm mt-1 font-sans">
              Kathmandu's Real-Time Ride Platform
            </p>
          </div>

          {/* Demo credentials hint */}
          {/* Demo credentials hint — click to autofill */}
          <button
            type="button"
            onClick={() => {
              setUsername("intern@namlotech.com");
              setPassword("namlo2026");
              setError("");
            }}
            className="w-full bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 mb-6 text-xs text-brand-300 font-mono text-center hover:bg-brand-500/20 transition-colors cursor-pointer"
          >
            <span className="text-dark-400">click to autofill → </span>
            intern@namlotech.com / namlo2026
          </button>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="intern@namlotech.com"
                className="w-full bg-dark-800 border border-dark-600 text-white placeholder-dark-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="••••••••"
                  className="w-full bg-dark-800 border border-dark-600 text-white placeholder-dark-500 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-500 to-orange-600 hover:from-brand-400 hover:to-orange-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin" /> Signing in…
                </>
              ) : (
                "Sign In to Namlo"
              )}
            </motion.button>
          </form>

          <p className="text-center text-dark-500 text-xs mt-6">
            Namlo Technologies Pvt. Ltd. · Kathmandu, Nepal
          </p>
        </div>
      </motion.div>
    </div>
  );
}
