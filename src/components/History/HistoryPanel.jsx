// src/components/History/HistoryPanel.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Car, History as HistoryIcon } from "lucide-react";
import { useRide } from "../../store/RideContext";
import { RIDE_STATUS } from "../../lib/rideStates";

const STATUS_ICON = {
  [RIDE_STATUS.COMPLETED]: <CheckCircle size={14} className="text-green-400" />,
  [RIDE_STATUS.CANCELLED]: <XCircle     size={14} className="text-dark-400"  />,
  [RIDE_STATUS.REJECTED]:  <AlertTriangle size={14} className="text-red-400" />,
  [RIDE_STATUS.NO_DRIVER]: <AlertTriangle size={14} className="text-orange-400" />,
};

const STATUS_COLOR = {
  [RIDE_STATUS.COMPLETED]: "text-green-400",
  [RIDE_STATUS.CANCELLED]: "text-dark-400",
  [RIDE_STATUS.REJECTED]:  "text-red-400",
  [RIDE_STATUS.NO_DRIVER]: "text-orange-400",
};

function HistoryCard({ item, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.05 }}
      className="bg-dark-800/50 border border-dark-700/50 rounded-xl p-4 space-y-3 hover:border-dark-600 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {STATUS_ICON[item.status] || <Clock size={14} className="text-dark-400" />}
          <span className={`text-sm font-medium capitalize ${STATUS_COLOR[item.status] || "text-dark-300"}`}>
            {item.status}
          </span>
        </div>
        <span className="text-xs text-dark-500">
          {new Date(item.createdAt || item.completedAt || Date.now()).toLocaleString("en-NP", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
          })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-dark-500">Driver</span>
          <p className="text-dark-200 font-medium mt-0.5">{item.driverName || "—"}</p>
        </div>
        <div>
          <span className="text-dark-500">Vehicle</span>
          <p className="text-dark-200 font-medium mt-0.5">{item.vehicleType || "—"}</p>
        </div>
        <div>
          <span className="text-dark-500">Distance</span>
          <p className="text-dark-200 font-medium mt-0.5">{item.distance ? `${item.distance} km` : "—"}</p>
        </div>
        <div>
          <span className="text-dark-500">Fare</span>
          <p className="text-brand-400 font-semibold mt-0.5">{item.fare ? `NPR ${item.fare}` : "—"}</p>
        </div>
      </div>

      {item.pickup && (
        <div className="text-xs text-dark-500 border-t border-dark-700 pt-2">
          <span className="text-dark-400">Route:</span>{" "}
          <span className="text-dark-300">{item.pickup}</span> →{" "}
          <span className="text-dark-300">{item.dropoff}</span>
        </div>
      )}

      {item.rideId && (
        <div className="text-xs text-dark-600 font-mono">
          #{item.rideId.substring(0, 8)}
        </div>
      )}
    </motion.div>
  );
}

export default function HistoryPanel() {
  const { history, historyLoading, loadHistory } = useRide();
  const [localLoading, setLocalLoading] = useState(false);
  const [lastLoadTime, setLastLoadTime] = useState(null);
  const [error, setError] = useState(null);

  const lastFetchTime = useRef(0);
  const fetchTimeoutRef = useRef(null);
  const isMounted = useRef(true);

  // Only show completed rides, already deduplicated in RideContext
  const completedRides = (history || []).filter((h) => h.status === RIDE_STATUS.COMPLETED);
  const totalEarnings = completedRides.reduce((sum, h) => sum + (h.fare || 0), 0);

  const handleLoadHistory = useCallback(async (force = false) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;

    if (!force && timeSinceLastFetch < 5000 && lastFetchTime.current !== 0) {
      const waitTime = 5000 - timeSinceLastFetch;
      setError(`Please wait ${Math.ceil(waitTime / 1000)} seconds before refreshing`);

      fetchTimeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          setError(null);
          handleLoadHistory(false);
        }
      }, waitTime);
      return;
    }

    if (localLoading || historyLoading) return;

    setLocalLoading(true);
    setError(null);

    try {
      lastFetchTime.current = Date.now();
      await loadHistory();
      if (isMounted.current) {
        setLastLoadTime(new Date());
      }
    } catch (err) {
      console.error("Error loading history:", err);
      if (isMounted.current) {
        setError(err.message || "Failed to load history");
      }
    } finally {
      if (isMounted.current) {
        setLocalLoading(false);
      }
    }
  }, [loadHistory, historyLoading, localLoading]);

  useEffect(() => {
    isMounted.current = true;

    const initLoad = async () => {
      if (isMounted.current && !lastLoadTime && !history.length) {
        await handleLoadHistory(true);
      }
    };

    initLoad();

    return () => {
      isMounted.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab visible — use refresh button to update");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <HistoryIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-white font-display font-bold text-lg leading-none">History</h2>
            <p className="text-dark-400 text-xs mt-0.5">
              {lastLoadTime ? `Last updated: ${lastLoadTime.toLocaleTimeString()}` : "Completed rides"}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleLoadHistory(true)}
          disabled={historyLoading || localLoading}
          className="w-8 h-8 bg-dark-800 border border-dark-700 rounded-lg flex items-center justify-center text-dark-400 hover:text-white hover:border-dark-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh history"
        >
          <RefreshCw size={14} className={(historyLoading || localLoading) ? "animate-spin" : ""} />
        </motion.button>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <p className="text-red-400 text-xs">{error}</p>
          <button
            onClick={() => handleLoadHistory(true)}
            className="mt-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-all"
          >
            Try Again
          </button>
        </motion.div>
      )}

      {/* Stats bar */}
      {completedRides.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2"
        >
          <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-green-400">{completedRides.length}</div>
            <div className="text-xs text-dark-500">Total Completed</div>
          </div>
          <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-brand-400">NPR {totalEarnings.toLocaleString()}</div>
            <div className="text-xs text-dark-500">Total Earnings</div>
          </div>
        </motion.div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        <AnimatePresence mode="wait">
          {(historyLoading || localLoading) && !completedRides.length ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 gap-3"
            >
              <RefreshCw size={24} className="text-dark-500 animate-spin" />
              <p className="text-dark-400 text-sm">Loading history...</p>
            </motion.div>
          ) : completedRides.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 gap-3"
            >
              <div className="w-16 h-16 bg-dark-800 rounded-2xl flex items-center justify-center">
                <Car className="w-8 h-8 text-dark-600" />
              </div>
              <div className="text-center">
                <p className="text-dark-300 font-medium text-sm">No completed rides yet</p>
                <p className="text-dark-500 text-xs mt-1">Complete a ride to see it here</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleLoadHistory(true)}
                  className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-all"
                >
                  Refresh
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* FIX: use _stableKey (rideId) as the React key — guaranteed unique after dedup */}
              {completedRides.map((item, i) => (
                <HistoryCard key={item._stableKey} item={item} index={i} />
              ))}

              {(historyLoading || localLoading) && completedRides.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-4"
                >
                  <RefreshCw size={12} className="text-dark-500 animate-spin" />
                  <span className="text-xs text-dark-500">Refreshing...</span>
                </motion.div>
              )}

              <div className="text-center py-2">
                <p className="text-dark-600 text-[10px]">
                  Click refresh to update • Auto-refresh disabled to prevent rate limiting
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}