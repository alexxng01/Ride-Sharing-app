// src/store/RideContext.js
import React, {
  createContext, useContext, useState,
  useEffect, useRef, useCallback
} from "react";
import { ref, onValue, set, off, remove } from "firebase/database";
import { db } from "../lib/firebase";
import { rideHistoryApi } from "../lib/api";
import {
  RIDE_STATUS, TERMINAL_STATES,
  randomKtmCoord, calcDistance, calcFare,
  interpolate, fetchOsrmRoute
} from "../lib/rideStates";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";

const RideContext = createContext(null);

const DRIVER_NAMES  = ["Prakash B.", "Sanjay T.", "Ramesh K.", "Hari P.", "Bikash M."];
const VEHICLE_TYPES = ["Motorcycle", "Car", "Electric Bike"];
const PLATES        = ["BA 1 PA 1234", "BA 2 JA 5678", "BA 3 KA 9012", "BA 4 MA 3456"];

const MIN_DRIVER_DISTANCE_KM = 0;
const MAX_DRIVER_DISTANCE_KM = 2.0;

export function RideProvider({ children }) {
  const [ride, setRide] = useState(null);
  const [role, setRole] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastHistoryUpdate, setLastHistoryUpdate] = useState(null);
  const [pendingHistoryUpdates, setPendingHistoryUpdates] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [navStats, setNavStats] = useState(null);
  const [mapSelectionMode, setMapSelectionMode] = useState(null);
  // Coords picked by clicking the map. Distinct from ride.pickup/dropoff so
  // the user can preview a location before committing it to the booking form.
  const [mapSelectedPickup,  setMapSelectedPickup]  = useState(null);
  const [mapSelectedDropoff, setMapSelectedDropoff] = useState(null);
  const [nearbyRides, setNearbyRides] = useState([]);
  const [isDriverNearby, setIsDriverNearby] = useState(false);
  const [driverDistanceToPickup, setDriverDistanceToPickup] = useState(null);

  const driverPositionRef = useRef(null);
  const positionListeners = useRef(new Set());
  const [driverPosition, setDriverPosition] = useState(null);

  const rideRef = useRef(null);
  const posRef = useRef(null);
  const moveInterval = useRef(null);
  const noDriverTimer = useRef(null);
  const rideTimeoutTimer = useRef(null);
  const historyRefreshInterval = useRef(null);
  const isMounted = useRef(true);
  const lastUpdateTime = useRef(0);
  const pendingNavStats = useRef(null);
  const throttleTimeout = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const devicePos = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        driverPositionRef.current = devicePos;
        setDriverPosition(devicePos);
        notifyPositionListeners(devicePos);
        try {
          await set(ref(db, "driverPosition"), devicePos);
        } catch (e) {
          console.warn("Failed to set initial device position:", e);
        }
      },
      (err) => {
        console.warn("Geolocation error, using random Kathmandu coord:", err);
        const fallback = randomKtmCoord();
        driverPositionRef.current = fallback;
        setDriverPosition(fallback);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []); // eslint-disable-line

  const updateRide = useCallback(async (data) => {
    await set(ref(db, "currentRide"), data);
  }, []);

  const updatePos = useCallback(async (pos) => {
    await set(ref(db, "driverPosition"), pos);
  }, []);

  const isDriverWithinRange = useCallback((driverPos, pickupPos) => {
    if (!driverPos || !pickupPos) return true;
    try {
      const distance = calcDistance(driverPos, pickupPos);
      return distance <= MAX_DRIVER_DISTANCE_KM;
    } catch (err) {
      console.warn("Distance calculation error:", err);
      return true;
    }
  }, []);

  const getFormattedDistance = useCallback((distanceKm) => {
    if (!distanceKm && distanceKm !== 0) return "—";
    if (distanceKm < 0.001) return "< 1m";
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
    return `${distanceKm.toFixed(1)}km`;
  }, []);

  // Throttle generation so we don't rebuild 3 rides on every GPS tick (every
  // ~1s during animation). 8s keeps the driver panel usable on low-end phones
  // without making nearby requests feel stale.
  const lastNearbyGenRef = useRef(0);
  const generateNearbyRides = useCallback((currentDriverPos) => {
    if (!currentDriverPos) {
      setNearbyRides([]);
      setIsDriverNearby(false);
      return;
    }

    const now = Date.now();
    if (now - lastNearbyGenRef.current < 8000) return;
    lastNearbyGenRef.current = now;

    const mockRides = [];
    const baseKtmCoord = { lat: 27.7172, lng: 85.3240 };

    for (let i = 0; i < 3; i++) {
      const offsetLat = (Math.random() - 0.5) * 0.02;
      const offsetLng = (Math.random() - 0.5) * 0.02;

      const pickup = {
        lat: baseKtmCoord.lat + offsetLat,
        lng: baseKtmCoord.lng + offsetLng,
      };

      const dropoffOffsetLat = (Math.random() - 0.5) * 0.02;
      const dropoffOffsetLng = (Math.random() - 0.5) * 0.02;

      const dropoff = {
        lat: baseKtmCoord.lat + dropoffOffsetLat,
        lng: baseKtmCoord.lng + dropoffOffsetLng,
      };

      const distanceToPickup = calcDistance(currentDriverPos, pickup);
      if (!Number.isFinite(distanceToPickup)) continue;

      if (distanceToPickup <= MAX_DRIVER_DISTANCE_KM) {
        const distance = calcDistance(pickup, dropoff);
        if (!Number.isFinite(distance)) continue;
        mockRides.push({
          id: uuid(),
          pickup,
          dropoff,
          fare: Math.round(calcFare(distance)),
          distance: distance.toFixed(2),
          distanceToPickup,
          distanceFormatted: getFormattedDistance(distanceToPickup),
          status: RIDE_STATUS.REQUESTING,
          riderName: `Rider ${i + 1}`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    setNearbyRides(mockRides);
    setIsDriverNearby(mockRides.length > 0);
  }, [getFormattedDistance]);

  // ── FIX: Deduplicate history by rideId before setting state ────────────────
  const loadHistory = useCallback(async (silent = false) => {
    if (!isMounted.current) return;

    if (!silent) {
      setHistoryLoading(true);
    }

    try {
      const data = await rideHistoryApi.getAll();

      // Deduplicate by rideId — keep the latest entry if duplicates exist
      const seen = new Map();
      (data || []).forEach((item, index) => {
        const key = item.rideId || item.id;
        if (!key) return; // skip entries with no identifier
        if (!seen.has(key)) {
          seen.set(key, { ...item, _stableKey: key });
        }
      });

      const deduped = Array.from(seen.values()).sort((a, b) => {
        const dateA = new Date(a.createdAt || a.completedAt || 0);
        const dateB = new Date(b.createdAt || b.completedAt || 0);
        return dateB - dateA;
      });

      if (isMounted.current) {
        setHistory(deduped);
        setLastHistoryUpdate(new Date());
      }
    } catch (error) {
      console.error("Error loading history:", error);
      if (isMounted.current && !silent) {
        toast.error("Failed to load history");
      }
    } finally {
      if (isMounted.current && !silent) {
        setHistoryLoading(false);
      }
    }
  }, []);

  // Format a coord pair safely; returns "—" if either is missing/non-numeric.
  const formatCoord = (c) => {
    const lat = Number(c?.lat ?? c?.latitude);
    const lng = Number(c?.lng ?? c?.longitude);
    if (!isFinite(lat) || !isFinite(lng)) return "—";
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const persistRide = useCallback(async (rideData) => {
    if (!isMounted.current) return;
    if (!rideData) {
      console.warn("persistRide called with no rideData; skipping.");
      return;
    }

    // Guard against malformed rides (e.g. attacker wrote partial state to
    // the world-readable Firebase path). Without this, terminal transitions
    // crash with "Cannot read properties of undefined (reading 'toFixed')".
    const historyEntry = {
      rideId:      rideData.id,
      riderId:     rideData.riderId,
      riderName:   rideData.riderName,
      driverName:  rideData.driverName  || "N/A",
      vehicleType: rideData.vehicleType || "N/A",
      plate:       rideData.plate       || "N/A",
      pickup:      formatCoord(rideData.pickup),
      dropoff:     formatCoord(rideData.dropoff),
      status:      rideData.status,
      fare:        Number(rideData.fare)     || 0,
      distance:    Number(rideData.distance) || 0,
      duration:    Number(rideData.duration) || 0,
      createdAt:   rideData.createdAt || new Date().toISOString(),
      completedAt: rideData.status === RIDE_STATUS.COMPLETED ? new Date().toISOString() : null,
    };

    setPendingHistoryUpdates(prev => [...prev, historyEntry]);
  }, []);

  // Max times a single failed entry is re-queued. After this, we drop it
  // (with a toast) so a permanently-broken write can't loop forever and
  // spam "Ride saved to history!" toasts on every iteration.
  const MAX_PERSIST_RETRIES = 3;
  // rideId -> retry count, kept in a ref to avoid re-renders.
  const persistRetriesRef = useRef(new Map());
  // Re-entry guard: prevents the pending-updates useEffect from triggering
  // overlapping runs of processPendingUpdates. Without this, async state
  // updates in the for loop can re-enter the effect and (combined with the
  // failed-entry re-queue) hit React's "Maximum update depth" guard.
  const processingPendingRef = useRef(false);

  // Stable ref to the latest processPendingUpdates so the useEffect below
  // can call it without having it in its deps array (which would re-fire
  // the effect on every identity change of the callback).
  const processPendingUpdatesRef = useRef(null);

  const processPendingUpdates = useCallback(async () => {
    if (processingPendingRef.current) return; // re-entry guard
    processingPendingRef.current = true;

    try {
      const updates = [...pendingHistoryUpdates];
      if (updates.length === 0) return;
      setPendingHistoryUpdates([]);

      for (const rideData of updates) {
        const key = rideData.rideId || rideData.id;
        const tries = (key && persistRetriesRef.current.get(key)) || 0;

        if (key && tries >= MAX_PERSIST_RETRIES) {
          console.warn(`Dropping ride ${key} after ${tries} failed persists.`);
          persistRetriesRef.current.delete(key);
          if (isMounted.current) {
            toast.error("Couldn't save ride to history. Skipped after multiple attempts.");
          }
          continue;
        }

        try {
          await rideHistoryApi.create(rideData);
          if (key) persistRetriesRef.current.delete(key);
          if (isMounted.current) {
            toast.success("Ride saved to history!", { icon: "📜" });
          }
        } catch (e) {
          console.warn("History persist failed:", e);
          if (isMounted.current && key) {
            persistRetriesRef.current.set(key, tries + 1);
            // Re-queue directly here, but only after this run finishes
            // (handled below by re-queuing outside the loop).
            setPendingHistoryUpdates(prev => [...prev, rideData]);
          }
        }
      }

      if (updates.length > 0 && isMounted.current) {
        await loadHistory(true);
      }
    } finally {
      processingPendingRef.current = false;
    }
  }, [pendingHistoryUpdates, loadHistory]);

  // Keep ref pointing at the latest version of processPendingUpdates.
  useEffect(() => { processPendingUpdatesRef.current = processPendingUpdates; }, [processPendingUpdates]);

  const startRideTimeout = useCallback((rideData) => {
    if (rideTimeoutTimer.current) {
      clearTimeout(rideTimeoutTimer.current);
    }

    rideTimeoutTimer.current = setTimeout(async () => {
      if (!isMounted.current) return;

      const snap = await new Promise((res) => {
        const r = ref(db, "currentRide");
        onValue(r, (s) => { res(s.val()); off(r); }, { onlyOnce: true });
      });

      if (snap && (snap.status === RIDE_STATUS.REQUESTING || snap.status === RIDE_STATUS.PROCESSING)) {
        const cancelledRide = { ...snap, status: RIDE_STATUS.NO_DRIVER };
        await updateRide(cancelledRide);
        await persistRide(cancelledRide);
        toast.error("No drivers available. Ride cancelled after 2 minutes.", { duration: 5000 });

        if (isMounted.current) {
          setRide(null);
        }

        setTimeout(async () => {
          try {
            await remove(ref(db, "currentRide"));
            await remove(ref(db, "driverPosition"));
          } catch (err) {
            console.error("Failed to clear ride from database:", err);
          }
        }, 3000);
      }

      rideTimeoutTimer.current = null;
    }, 120000);
  }, [updateRide, persistRide]);

  const clearRideTimeout = useCallback(() => {
    if (rideTimeoutTimer.current) {
      clearTimeout(rideTimeoutTimer.current);
      rideTimeoutTimer.current = null;
    }
  }, []);

  const calculateRealTimeETA = useCallback((currentPos, destination) => {
    if (!currentPos || !destination) return null;

    const distance = calcDistance(currentPos, destination);
    const avgSpeedKmh = 30;
    const timeHours = distance / avgSpeedKmh;
    const totalSeconds = Math.floor(timeHours * 3600);

    return {
      distanceKm: distance.toFixed(1),
      totalSeconds: totalSeconds,
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60,
      display: totalSeconds < 60 ? `${totalSeconds}s` : `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
    };
  }, []);

  const updateNavStatsThrottled = useCallback((newStats) => {
    if (!isMounted.current) return;

    const now = Date.now();
    pendingNavStats.current = newStats;

    if (throttleTimeout.current) {
      clearTimeout(throttleTimeout.current);
    }

    if (now - lastUpdateTime.current >= 1000) {
      lastUpdateTime.current = now;
      setNavStats(pendingNavStats.current);
      pendingNavStats.current = null;
    } else {
      throttleTimeout.current = setTimeout(() => {
        if (isMounted.current && pendingNavStats.current) {
          setNavStats(pendingNavStats.current);
          pendingNavStats.current = null;
          lastUpdateTime.current = Date.now();
        }
        throttleTimeout.current = null;
      }, 1000 - (now - lastUpdateTime.current));
    }
  }, []);

  const notifyPositionListeners = useCallback((position) => {
    positionListeners.current.forEach(listener => {
      try {
        listener(position);
      } catch (e) {
        console.warn("Position listener error:", e);
      }
    });
  }, []);

  const animateAlongRouteOptimized = useCallback((waypoints, totalMs, intervalMs = 1500, onStep, onDone) => {
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }

    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      onDone?.();
      return;
    }

    let step = 0;
    let lastSentT = -1;
    const startTime = Date.now();

    moveInterval.current = setInterval(async () => {
      step++;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);
      const idx = Math.min(
        Math.floor(t * (waypoints.length - 1)),
        waypoints.length - 1
      );
      const pos = waypoints[idx];
      if (!pos || !Number.isFinite(Number(pos?.lat)) || !Number.isFinite(Number(pos?.lng))) {
        return; // skip bad waypoints rather than crash
      }
      await updatePos(pos);

      if (Math.abs(t - lastSentT) > 0.1) {
        lastSentT = t;
        const remainingSeconds = Math.max(0, (totalMs - elapsed) / 1000);
        onStep?.(pos, t, remainingSeconds);
      }

      if (t >= 1) {
        if (moveInterval.current) {
          clearInterval(moveInterval.current);
          moveInterval.current = null;
        }
        onDone?.();
      }
    }, intervalMs);
  }, [updatePos]);

  const animateMoveOptimized = useCallback((from, to, totalMs, intervalMs = 1500, onDone) => {
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }

    if (!from || !to) {
      // Defensive: Firebase can return a null ride mid-flight, and interpolate()
      // returns null for malformed coords. Skip the animation rather than
      // throw inside the interval (which would spam the console forever).
      console.warn("animateMoveOptimized: missing from/to, skipping");
      onDone?.();
      return;
    }

    let step = 0;
    const startTime = Date.now();

    moveInterval.current = setInterval(async () => {
      step++;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);
      const pos = interpolate(from, to, t);
      if (!pos) return; // invalid coords — wait for next tick
      await updatePos(pos);
      if (t >= 1) {
        if (moveInterval.current) {
          clearInterval(moveInterval.current);
          moveInterval.current = null;
        }
        onDone?.();
      }
    }, intervalMs);
  }, [updatePos]);

  const initializeNavStats = useCallback((rideData) => {
    if (!rideData) return;

    let remainingM = 0;
    let remainingS = 0;

    if (rideData.status === RIDE_STATUS.ACCEPTED && rideData.pickup && rideData.driverStart) {
      remainingM = Math.round(calcDistance(rideData.driverStart, rideData.pickup) * 1000);
      remainingS = Math.round(remainingM / 14);
    } else if (rideData.status === RIDE_STATUS.ARRIVED && rideData.pickup) {
      remainingM = 0;
      remainingS = 0;
    } else if (rideData.status === RIDE_STATUS.ACTIVE && rideData.pickup && rideData.dropoff) {
      remainingM = Math.round(calcDistance(rideData.pickup, rideData.dropoff) * 1000);
      remainingS = Math.round(remainingM / 14);
    }

    if (remainingM > 0 || remainingS > 0 || rideData.status === RIDE_STATUS.ARRIVED) {
      setNavStats({
        remainingM,
        remainingS,
        progressT: 0,
        phase: rideData.status === RIDE_STATUS.ACCEPTED
          ? "to_pickup"
          : "to_dropoff",
      });
    }
  }, []);

  useEffect(() => {
    // Use the ref so we don't list the function in deps; otherwise the
    // effect re-fires every time processPendingUpdates gets a new identity
    // (which happens whenever pendingHistoryUpdates changes — redundant
    // with the first dep and a known cause of infinite re-render warnings).
    if (pendingHistoryUpdates.length > 0 && !historyLoading) {
      processPendingUpdatesRef.current?.();
    }
  }, [pendingHistoryUpdates, historyLoading]);

  // Declared early so the subscription useEffect below can reference `reset`
  // in its deps array without hitting a TDZ ReferenceError. These only read
  // refs and call setState — safe to call any time after mount.

  const resetMapSelection = useCallback(() => {
    setMapSelectionMode(null);
    setMapSelectedPickup(null);
    setMapSelectedDropoff(null);
  }, []);

  // Full reset — called by AuthContext on logout so the next user/session
  // doesn't inherit the previous user's ride, history, or pending writes.
  const reset = useCallback(() => {
    if (moveInterval.current) { clearInterval(moveInterval.current); moveInterval.current = null; }
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    persistRetriesRef.current.clear();
    setRide(null);
    setRole(null);
    setHistory([]);
    setHistoryLoading(false);
    setLastHistoryUpdate(null);
    setPendingHistoryUpdates([]);
    setRouteData(null);
    setNavStats(null);
    setMapSelectionMode(null);
    setMapSelectedPickup(null);
    setMapSelectedDropoff(null);
    setNearbyRides([]);
    setIsDriverNearby(false);
    setDriverDistanceToPickup(null);
    driverPositionRef.current = null;
    setDriverPosition(null);
  }, [clearRideTimeout]);

  useEffect(() => {
    isMounted.current = true;

    // Register the logout cleanup hook so AuthContext.logout() can wipe
    // ride state without a circular import. Lives on window because both
    // providers mount at the app root.
    if (typeof window !== "undefined") {
      window.__namlo_onLogout = reset;
    }

    const rideDbRef = ref(db, "currentRide");
    const posDbRef = ref(db, "driverPosition");
    rideRef.current = rideDbRef;
    posRef.current = posDbRef;

    const unsubRide = onValue(rideDbRef, (snap) => {
      if (isMounted.current) {
        const rideData = snap.val();
        setRide(rideData);

        if (rideData && rideData.status) {
          initializeNavStats(rideData);

          if (rideData.status === RIDE_STATUS.REQUESTING || rideData.status === RIDE_STATUS.PROCESSING) {
            startRideTimeout(rideData);
          } else {
            clearRideTimeout();
          }
        }
      }
    });

   const unsubPos = onValue(posDbRef, (snap) => {
  if (isMounted.current) {
    const position = snap.val();

    // ✅ Only update if position actually changed
    const prev = driverPositionRef.current;
    if (prev && position &&
        prev.lat === position.lat &&
        prev.lng === position.lng) return;

    driverPositionRef.current = position;
    setDriverPosition(position);
    notifyPositionListeners(position);

    if (position) {
      generateNearbyRides(position);
    }
  }
});

    return () => {
      isMounted.current = false;
      off(rideDbRef, "value", unsubRide);
      off(posDbRef, "value", unsubPos);
      clearInterval(moveInterval.current);
      clearTimeout(noDriverTimer.current);
      clearRideTimeout();
      if (throttleTimeout.current) {
        clearTimeout(throttleTimeout.current);
      }
      positionListeners.current.clear();
      if (typeof window !== "undefined") {
        delete window.__namlo_onLogout;
      }
    };
  }, [notifyPositionListeners, initializeNavStats, startRideTimeout, clearRideTimeout, generateNearbyRides, reset]);

  useEffect(() => {
    if (ride && TERMINAL_STATES.has(ride.status)) {
      if (moveInterval.current) {
        clearInterval(moveInterval.current);
        moveInterval.current = null;
      }
      clearRideTimeout();
    }
  }, [ride, clearRideTimeout]);

  const requestRide = useCallback(async (pickup, dropoff) => {
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    setRouteData(null);
    setNavStats(null);

    const newRide = {
      id:          uuid(),
      status:      RIDE_STATUS.REQUESTING,
      pickup,
      dropoff,
      riderId:     "rider-001",
      riderName:   "You (Rider)",
      driverName:  null,
      vehicleType: null,
      plate:       null,
      fare:        calcFare(calcDistance(pickup, dropoff)),
      distance:    +calcDistance(pickup, dropoff).toFixed(2),
      duration:    null,
      createdAt:   new Date().toISOString(),
    };

    await updateRide(newRide);
    toast.success("Ride requested! Looking for a driver...", { duration: 3000 });

    startRideTimeout(newRide);

    const [toPickupRoute, toDropoffRoute] = await Promise.all([
      fetchOsrmRoute(driverPositionRef.current || randomKtmCoord(), pickup),
      fetchOsrmRoute(pickup, dropoff),
    ]);
    setRouteData({ toPickup: toPickupRoute, toDropoff: toDropoffRoute });
  }, [updateRide, startRideTimeout, clearRideTimeout]);

  const cancelRide = useCallback(async () => {
    if (!ride) return;
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    setRouteData(null);
    setNavStats(null);
    const updated = { ...ride, status: RIDE_STATUS.CANCELLED };
    await updateRide(updated);
    await persistRide(updated);
    toast("Ride cancelled.", { icon: "🚫" });
  }, [ride, updateRide, persistRide, clearRideTimeout]);

  const acceptRide = useCallback(async () => {
    if (!ride) return;

    clearTimeout(noDriverTimer.current);
    clearRideTimeout();

    const driverStart = driverPositionRef.current || driverPosition || randomKtmCoord();
    const driverName   = DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)];
    const vehicleType  = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];
    const plate        = PLATES[Math.floor(Math.random() * PLATES.length)];

    const updated = {
      ...ride,
      status: RIDE_STATUS.ACCEPTED,
      driverName,
      vehicleType,
      plate,
      driverStart,
      acceptedAt: Date.now(),
    };

    await updateRide(updated);
    await updatePos(driverStart);

    const distKm = calcDistance(driverStart, ride.pickup);
    const eta = calculateRealTimeETA(driverStart, ride.pickup);

    updateNavStatsThrottled({
      remainingM: Math.round(distKm * 1000),
      remainingS: eta?.totalSeconds || Math.round((distKm / 14) * 3600),
      progressT: 0,
      phase: "to_pickup",
    });

    toast.success(`✅ Ride accepted by ${driverName}! Heading to pickup...`, { duration: 4000 });

    const route = await fetchOsrmRoute(driverStart, ride.pickup);
    if (route?.waypoints?.length) {
      const totalDistM = route.distanceM;
      const routeDurationS = route.durationS || (distKm / 30) * 3600;
      setRouteData((prev) => ({ ...prev, toPickup: route }));

      animateAlongRouteOptimized(route.waypoints, routeDurationS * 1000, 1000, (pos, t, remainingSeconds) => {
        if (!isMounted.current) return;
        const remainingM = Math.max(0, totalDistM * (1 - t));
        updateNavStatsThrottled({
          remainingM: Math.round(remainingM),
          remainingS: Math.round(remainingSeconds),
          progressT: t,
          phase: "to_pickup",
        });
      }, async () => {
        if (!isMounted.current) return;
        const arrived = { ...updated, status: RIDE_STATUS.ARRIVED };
        await updateRide(arrived);
        await updatePos(ride.pickup);
        setNavStats(null);
        toast("📍 Driver arrived at pickup!", { icon: "📍" });
      });
    } else {
      const totalMs = (distKm / 30) * 3600 * 1000;
      animateMoveOptimized(driverStart, ride.pickup, totalMs, 1000, async () => {
        if (!isMounted.current) return;
        const arrived = { ...updated, status: RIDE_STATUS.ARRIVED };
        await updateRide(arrived);
        await updatePos(ride.pickup);
        setNavStats(null);
        toast("📍 Driver arrived at pickup!", { icon: "📍" });
      });
    }
  }, [ride, driverPosition, updateRide, updatePos, updateNavStatsThrottled, animateAlongRouteOptimized, animateMoveOptimized, clearRideTimeout, calculateRealTimeETA]);

  const startRide = useCallback(async () => {
    if (!ride) return;

    const distanceKm = calcDistance(ride.pickup, ride.dropoff);
    const estimatedDurationSeconds = Math.max(120, (distanceKm / 30) * 3600);
    const eta = calculateRealTimeETA(ride.pickup, ride.dropoff);

    const updated = {
      ...ride,
      status: RIDE_STATUS.ACTIVE,
      startTime: Date.now(),
      estimatedDuration: estimatedDurationSeconds,
      remainingTime: estimatedDurationSeconds
    };

    await updateRide(updated);
    await updatePos(ride.pickup);

    updateNavStatsThrottled({
      remainingM: Math.round(distanceKm * 1000),
      remainingS: eta?.totalSeconds || estimatedDurationSeconds,
      progressT: 0,
      phase: "to_dropoff",
    });

    toast.success(`🚗 Ride started! ETA: ${eta?.display || Math.round(estimatedDurationSeconds / 60) + " minutes"}`, { duration: 4000 });

    const route = await fetchOsrmRoute(ride.pickup, ride.dropoff);
    if (route?.waypoints?.length) {
      const totalDistM = route.distanceM;
      const routeDurationS = route.durationS || estimatedDurationSeconds;
      setRouteData((prev) => ({ ...prev, toDropoff: route }));

      animateAlongRouteOptimized(route.waypoints, routeDurationS * 1000, 1000, (pos, t, remainingSeconds) => {
        if (!isMounted.current) return;
        const remainingM = Math.max(0, totalDistM * (1 - t));
        updateNavStatsThrottled({
          remainingM: Math.round(remainingM),
          remainingS: Math.round(remainingSeconds),
          progressT: t,
          phase: "to_dropoff",
        });
      }, async () => {
        if (!isMounted.current) return;
        const duration = Math.round((Date.now() - updated.startTime) / 1000);
        const completed = { ...updated, status: RIDE_STATUS.COMPLETED, duration };
        await updateRide(completed);
        await persistRide(completed);
        setNavStats(null);
        toast.success("🎉 You've arrived! Ride complete!");
      });
    } else {
      const totalMs = estimatedDurationSeconds * 1000;
      animateMoveOptimized(ride.pickup, ride.dropoff, totalMs, 1000, async () => {
        if (!isMounted.current) return;
        const duration = Math.round((Date.now() - updated.startTime) / 1000);
        const completed = { ...updated, status: RIDE_STATUS.COMPLETED, duration };
        await updateRide(completed);
        await persistRide(completed);
        setNavStats(null);
        toast.success("🎉 You've arrived! Ride complete!");
      });
    }
  }, [ride, updateRide, updatePos, updateNavStatsThrottled, animateAlongRouteOptimized, animateMoveOptimized, persistRide, calculateRealTimeETA]);

  const completeRide = useCallback(async () => {
    if (!ride) return;
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }
    const duration = ride.startTime
      ? Math.round((Date.now() - ride.startTime) / 1000)
      : 0;
    const completed = { ...ride, status: RIDE_STATUS.COMPLETED, duration };
    await updateRide(completed);
    await persistRide(completed);
    setNavStats(null);
    toast.success("🎉 Ride completed!");
  }, [ride, updateRide, persistRide]);

  const rejectRide = useCallback(async () => {
    if (!ride) return;
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    const updated = { ...ride, status: RIDE_STATUS.REJECTED };
    await updateRide(updated);
    await persistRide(updated);
    toast.error("Ride rejected.");
  }, [ride, updateRide, persistRide, clearRideTimeout]);

  const clearRide = useCallback(async () => {
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    setRouteData(null);
    setNavStats(null);
    setRide(null);

    // Clear the DB best-effort. If Firebase rejects (network, permissions),
    // we still want local state cleared and the user to see a toast —
    // otherwise "Clear" appears to do nothing and the modal feels stuck.
    try {
      await Promise.allSettled([
        remove(ref(db, "currentRide")),
        remove(ref(db, "driverPosition")),
      ]);
    } catch (e) {
      console.warn("clearRide: failed to remove from DB:", e);
      toast.error("Local ride cleared. Server sync will retry.");
    }
  }, [clearRideTimeout]);

  const subscribeToPosition = useCallback((listener) => {
    positionListeners.current.add(listener);
    if (driverPositionRef.current) {
      listener(driverPositionRef.current);
    }
    return () => {
      positionListeners.current.delete(listener);
    };
  }, []);

  const getCurrentPosition = useCallback(() => {
    return driverPositionRef.current;
  }, []);

  const refreshHistory = useCallback(async () => {
    await loadHistory(false);
  }, [loadHistory]);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Are you sure you want to clear all history?")) return;

    // Optimistic local clear so the UI updates immediately, regardless of
    // whether the API/localStorage call succeeds.
    setHistory([]);
    setPendingHistoryUpdates([]);
    persistRetriesRef.current.clear();

    try {
      await rideHistoryApi.clearAll();
      toast.success("History cleared");
    } catch (e) {
      console.warn("clearAll failed, but local state was already cleared:", e);
      toast.error("Cleared locally — server sync failed.");
    }
  }, []);

  // Called when the user clicks the map. Dispatches based on the current
  // selection mode set by the "Set Pickup"/"Set Dropoff" buttons in RideMap.
  const handleMapLocationClick = useCallback((coords) => {
    if (!coords) return;
    const lat = Number(coords.lat ?? coords.latitude);
    const lng = Number(coords.lng ?? coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const point = { lat, lng };

    if (mapSelectionMode === "pickup")  setMapSelectedPickup(point);
    if (mapSelectionMode === "dropoff") setMapSelectedDropoff(point);
    // Always clear mode after a click so the user can resume normal panning.
    setMapSelectionMode(null);
  }, [mapSelectionMode]);

  const isRideActive = ride && [RIDE_STATUS.ACCEPTED, RIDE_STATUS.ARRIVED, RIDE_STATUS.ACTIVE].includes(ride?.status);

  const value = {
    ride,
    driverPosition,
    getCurrentPosition,
    subscribeToPosition,
    role,
    setRole,
    routeData,
    navStats,
    history,
    historyLoading,
    lastHistoryUpdate,
    loadHistory,
    refreshHistory,
    clearHistory,
    handleMapLocationClick,
    requestRide,
    cancelRide,
    acceptRide,
    startRide,
    completeRide,
    rejectRide,
    clearRide,
    isRideActive,
    mapSelectionMode,
    setMapSelectionMode,
    calculateRealTimeETA,
    nearbyRides,
    isDriverNearby,
    driverDistanceToPickup,
    isDriverWithinRange,
    getFormattedDistance,
    MAX_DRIVER_DISTANCE_KM,
    MIN_DRIVER_DISTANCE_KM,
    mapSelectedPickup,
    mapSelectedDropoff,
    resetMapSelection,
    reset,
  };

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  );
}

export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error("useRide must be used within a RideProvider");
  }
  return context;
};