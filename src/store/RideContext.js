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

// ── Constants ──────────────────────────────────────────────────────────────────
const DRIVER_NAMES  = ["Prakash B.", "Sanjay T.", "Ramesh K.", "Hari P.", "Bikash M."];
const VEHICLE_TYPES = ["Motorcycle", "Car", "Electric Bike"];
const PLATES        = ["BA 1 PA 1234", "BA 2 JA 5678", "BA 3 KA 9012", "BA 4 MA 3456"];
const MAX_DRIVER_KM = 2.0;
const MIN_DRIVER_KM = 0;
const RIDE_TIMEOUT_MS = 120_000; // 2 minutes

// ── Helpers ────────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function RideProvider({ children }) {

  // ── State ────────────────────────────────────────────────────────────────────
  const [ride,             setRide]             = useState(null);
  const [driverPosition,   setDriverPosition]   = useState(null);
  const [routeData,        setRouteData]        = useState(null);
  const [navStats,         setNavStats]         = useState(null);
  const [history,          setHistory]          = useState([]);
  const [historyLoading,   setHistoryLoading]   = useState(false);
  const [lastHistoryUpdate,setLastHistoryUpdate]= useState(null);
  const [nearbyRides,      setNearbyRides]      = useState([]);
  const [isDriverNearby,   setIsDriverNearby]   = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState(null);

  // ── Refs (never stale in callbacks) ──────────────────────────────────────────
  const isMounted          = useRef(true);
  const driverPosRef       = useRef(null);   // always holds latest driver position
  const posListeners       = useRef(new Set());
  const moveInterval       = useRef(null);
  const rideTimeoutTimer   = useRef(null);
  const noDriverTimer      = useRef(null);
  const throttleTimer      = useRef(null);
  const pendingNavStats    = useRef(null);
  const lastNavUpdate      = useRef(0);
  const pendingHistory     = useRef([]);     // avoids stale-closure issues with setPending

  // ── Notify position listeners ─────────────────────────────────────────────────
  const notifyPos = useCallback((pos) => {
    posListeners.current.forEach((fn) => {
      try { fn(pos); } catch {}
    });
  }, []);

  // ── Firebase write helpers ────────────────────────────────────────────────────
  const writeRide = useCallback(async (data) => {
    await set(ref(db, "currentRide"), data);
  }, []);

  const writePos = useCallback(async (pos) => {
    await set(ref(db, "driverPosition"), pos);
    driverPosRef.current = pos;
    if (isMounted.current) setDriverPosition(pos);
    notifyPos(pos);
  }, [notifyPos]);

  // ── Throttled navStats update (max 1/s) ───────────────────────────────────────
  const updateNavStats = useCallback((stats) => {
    if (!isMounted.current) return;
    pendingNavStats.current = stats;
    const now = Date.now();
    const gap = now - lastNavUpdate.current;

    if (gap >= 1000) {
      lastNavUpdate.current = now;
      setNavStats(stats);
      pendingNavStats.current = null;
    } else {
      clearTimeout(throttleTimer.current);
      throttleTimer.current = setTimeout(() => {
        if (isMounted.current && pendingNavStats.current) {
          setNavStats(pendingNavStats.current);
          pendingNavStats.current = null;
          lastNavUpdate.current = Date.now();
        }
      }, 1000 - gap);
    }
  }, []);

  // ── Distance helpers ──────────────────────────────────────────────────────────
  const getFormattedDistance = useCallback((km) => {
    if (km == null) return "—";
    if (km < 0.001) return "< 1 m";
    if (km < 1)     return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }, []);

  const isDriverWithinRange = useCallback((driverPos, pickupPos) => {
    if (!driverPos || !pickupPos) return true;
    return calcDistance(driverPos, pickupPos) <= MAX_DRIVER_KM;
  }, []);

  const calculateRealTimeETA = useCallback((from, to) => {
    if (!from || !to) return null;
    const dist    = calcDistance(from, to);
    const seconds = Math.floor((dist / 30) * 3600);
    return {
      distanceKm:   dist.toFixed(1),
      totalSeconds: seconds,
      minutes:      Math.floor(seconds / 60),
      seconds:      seconds % 60,
      display:      seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`,
    };
  }, []);

  // ── Ride timeout: auto-cancel if no driver in 2 min ──────────────────────────
  const clearRideTimeout = useCallback(() => {
    clearTimeout(rideTimeoutTimer.current);
    rideTimeoutTimer.current = null;
  }, []);

  const startRideTimeout = useCallback((rideData) => {
    clearRideTimeout();
    rideTimeoutTimer.current = setTimeout(async () => {
      if (!isMounted.current) return;
      // Re-check current DB state
      const snap = await new Promise((res) => {
        const r = ref(db, "currentRide");
        onValue(r, (s) => { res(s.val()); off(r); }, { onlyOnce: true });
      });
      if (
        snap &&
        (snap.status === RIDE_STATUS.REQUESTING || snap.status === RIDE_STATUS.PROCESSING)
      ) {
        const cancelled = { ...snap, status: RIDE_STATUS.NO_DRIVER };
        await writeRide(cancelled);
        toast.error("No drivers available. Ride cancelled.", { duration: 5000 });
        // Clean up after 3 s
        setTimeout(async () => {
          try {
            await remove(ref(db, "currentRide"));
            await remove(ref(db, "driverPosition"));
          } catch {}
        }, 3000);
      }
    }, RIDE_TIMEOUT_MS);
  }, [clearRideTimeout, writeRide]);

  // ── Movement animation (route waypoints) ─────────────────────────────────────
  const stopMovement = useCallback(() => {
    clearInterval(moveInterval.current);
    moveInterval.current = null;
  }, []);

  const animateRoute = useCallback((waypoints, durationMs, onStep, onDone) => {
    stopMovement();
    if (!waypoints?.length) { onDone?.(); return; }

    const start = Date.now();
    moveInterval.current = setInterval(async () => {
      const t   = Math.min((Date.now() - start) / durationMs, 1);
      const idx = Math.min(Math.floor(t * (waypoints.length - 1)), waypoints.length - 1);
      await writePos(waypoints[idx]);
      onStep?.(waypoints[idx], t, Math.max(0, (durationMs - (Date.now() - start)) / 1000));
      if (t >= 1) { stopMovement(); onDone?.(); }
    }, 1500);
  }, [stopMovement, writePos]);

  const animateLinear = useCallback((from, to, durationMs, onDone) => {
    stopMovement();
    const start = Date.now();
    moveInterval.current = setInterval(async () => {
      const t = Math.min((Date.now() - start) / durationMs, 1);
      await writePos(interpolate(from, to, t));
      if (t >= 1) { stopMovement(); onDone?.(); }
    }, 1500);
  }, [stopMovement, writePos]);

  // ── Persist ride to history ───────────────────────────────────────────────────
  const persistRide = useCallback((rideData) => {
    const entry = {
      rideId:      rideData.id,
      riderId:     rideData.riderId,
      riderName:   rideData.riderName,
      driverName:  rideData.driverName  || "N/A",
      vehicleType: rideData.vehicleType || "N/A",
      plate:       rideData.plate       || "N/A",
      pickup:      rideData.pickup
        ? `${rideData.pickup.lat.toFixed(4)}, ${rideData.pickup.lng.toFixed(4)}`
        : "N/A",
      dropoff:     rideData.dropoff
        ? `${rideData.dropoff.lat.toFixed(4)}, ${rideData.dropoff.lng.toFixed(4)}`
        : "N/A",
      status:      rideData.status,
      fare:        rideData.fare,
      distance:    rideData.distance,
      duration:    rideData.duration || 0,
      createdAt:   rideData.createdAt,
      completedAt: rideData.status === RIDE_STATUS.COMPLETED ? new Date().toISOString() : null,
    };
    // Queue for async write (avoids stale state in callbacks)
    pendingHistory.current = [...pendingHistory.current, entry];
  }, []);

  // ── Load history from API ─────────────────────────────────────────────────────
  const loadHistory = useCallback(async (silent = false) => {
    if (!isMounted.current) return;
    if (!silent) setHistoryLoading(true);
    try {
      const data = await rideHistoryApi.getAll();
      // Deduplicate by rideId
      const seen = new Map();
      (data || []).forEach((item) => {
        const key = item.rideId || item.id;
        if (key && !seen.has(key)) seen.set(key, { ...item, _stableKey: key });
      });
      const deduped = Array.from(seen.values()).sort((a, b) =>
        new Date(b.createdAt || b.completedAt || 0) - new Date(a.createdAt || a.completedAt || 0)
      );
      if (isMounted.current) {
        setHistory(deduped);
        setLastHistoryUpdate(new Date());
      }
    } catch (err) {
      console.error("loadHistory error:", err);
      if (!silent && isMounted.current) toast.error("Failed to load ride history.");
    } finally {
      if (!silent && isMounted.current) setHistoryLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(() => loadHistory(false), [loadHistory]);

  const clearHistory = useCallback(() => {
    if (window.confirm("Clear all local history?")) {
      setHistory([]);
      pendingHistory.current = [];
      toast.success("History cleared.");
    }
  }, []);

  // ── Flush pending history writes ──────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isMounted.current || pendingHistory.current.length === 0) return;
      const batch = [...pendingHistory.current];
      pendingHistory.current = [];
      let saved = false;
      for (const entry of batch) {
        try {
          await rideHistoryApi.create(entry);
          saved = true;
        } catch {
          // Put back on failure
          pendingHistory.current = [...pendingHistory.current, entry];
        }
      }
      if (saved && isMounted.current) {
        await loadHistory(true);
        toast.success("Ride saved to history!", { icon: "📜" });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  // ── Init navStats from ride state ─────────────────────────────────────────────
  const initNavStats = useCallback((rideData) => {
    if (!rideData) return;
    if (rideData.status === RIDE_STATUS.ACCEPTED && rideData.pickup && rideData.driverStart) {
      const dist = calcDistance(rideData.driverStart, rideData.pickup);
      updateNavStats({ remainingM: Math.round(dist * 1000), remainingS: Math.round((dist / 14) * 3600), progressT: 0, phase: "to_pickup" });
    } else if (rideData.status === RIDE_STATUS.ACTIVE && rideData.pickup && rideData.dropoff) {
      const dist = calcDistance(rideData.pickup, rideData.dropoff);
      updateNavStats({ remainingM: Math.round(dist * 1000), remainingS: Math.round((dist / 14) * 3600), progressT: 0, phase: "to_dropoff" });
    } else if (rideData.status === RIDE_STATUS.ARRIVED) {
      updateNavStats({ remainingM: 0, remainingS: 0, progressT: 1, phase: "arrived" });
    }
  }, [updateNavStats]);

  // ── Nearby rides (mock) ───────────────────────────────────────────────────────
  const generateNearbyRides = useCallback((driverPos) => {
    if (!driverPos) { setNearbyRides([]); setIsDriverNearby(false); return; }
    const base = { lat: 27.7172, lng: 85.3240 };
    const rides = [];
    for (let i = 0; i < 3; i++) {
      const pickup  = { lat: base.lat + (Math.random() - 0.5) * 0.02, lng: base.lng + (Math.random() - 0.5) * 0.02 };
      const dropoff = { lat: base.lat + (Math.random() - 0.5) * 0.02, lng: base.lng + (Math.random() - 0.5) * 0.02 };
      const dtp = calcDistance(driverPos, pickup);
      if (dtp <= MAX_DRIVER_KM) {
        const dist = calcDistance(pickup, dropoff);
        rides.push({
          id: uuid(), pickup, dropoff,
          fare: Math.round(calcFare(dist)),
          distance: dist.toFixed(2),
          distanceToPickup: dtp,
          distanceFormatted: getFormattedDistance(dtp),
          status: RIDE_STATUS.REQUESTING,
          riderName: `Rider ${i + 1}`,
          createdAt: new Date().toISOString(),
        });
      }
    }
    setNearbyRides(rides);
    setIsDriverNearby(rides.length > 0);
  }, [getFormattedDistance]);

  // ── Firebase listeners (mounted once) ────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    const _notifyPos          = notifyPos;
    const _initNavStats       = initNavStats;
    const _startRideTimeout   = startRideTimeout;
    const _clearRideTimeout   = clearRideTimeout;
    const _generateNearbyRides= generateNearbyRides;
    const _stopMovement       = stopMovement;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          driverPosRef.current = c;
          if (isMounted.current) setDriverPosition(c);
          _notifyPos(c);
          set(ref(db, "driverPosition"), c).catch(() => {});
        },
        () => {
          const fallback = randomKtmCoord();
          driverPosRef.current = fallback;
          if (isMounted.current) setDriverPosition(fallback);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    const rideDbRef = ref(db, "currentRide");
    const unsubRide = onValue(rideDbRef, (snap) => {
      if (!isMounted.current) return;
      const data = snap.val();
      setRide(data);
      if (data?.status) {
        _initNavStats(data);
        if ([RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING].includes(data.status)) {
          _startRideTimeout(data);
        } else {
          _clearRideTimeout();
        }
      }
    });

    const posDbRef  = ref(db, "driverPosition");
    const unsubPos  = onValue(posDbRef, (snap) => {
      if (!isMounted.current) return;
      const pos  = snap.val();
      const prev = driverPosRef.current;
      if (prev && pos && prev.lat === pos.lat && prev.lng === pos.lng) return;
      driverPosRef.current = pos;
      setDriverPosition(pos);
      _notifyPos(pos);
      if (pos) _generateNearbyRides(pos);
    });

    return () => {
      isMounted.current = false;
      off(rideDbRef, "value", unsubRide);
      off(posDbRef,  "value", unsubPos);
      _stopMovement();
      _clearRideTimeout();
      clearTimeout(noDriverTimer.current);
      clearTimeout(throttleTimer.current);
      posListeners.current.clear();
    };
  }, []);

  // Stop movement when ride reaches terminal state
  useEffect(() => {
    if (ride && TERMINAL_STATES.has(ride.status)) {
      stopMovement();
      clearRideTimeout();
    }
  }, [ride, stopMovement, clearRideTimeout]);

  // ── PUBLIC ACTIONS ────────────────────────────────────────────────────────────

  // REQUEST a new ride - UPDATED to handle both formats
  const requestRide = useCallback(async (pickupData, dropoffData) => {
    // Handle both formats:
    // 1. requestRide(pickupCoords, dropoffCoords) - old format
    // 2. requestRide({ pickup: {...}, dropoff: {...} }) - new format
    let pickup, dropoff;
    
    if (pickupData && typeof pickupData === 'object' && pickupData.lat !== undefined) {
      // Old format: requestRide(pickupCoords, dropoffCoords)
      pickup = pickupData;
      dropoff = dropoffData;
    } else if (pickupData && typeof pickupData === 'object' && pickupData.pickup) {
      // New format: requestRide({ pickup: {...}, dropoff: {...} })
      pickup = pickupData.pickup;
      dropoff = pickupData.dropoff;
      // Also extract service info if available
      const serviceInfo = {
        serviceType: pickupData.serviceType || 'car',
        vehicleType: pickupData.vehicleType || 'Car',
        fare: pickupData.fare || 0,
        distance: pickupData.distance || '0',
        estimatedTime: pickupData.estimatedTime || '5-8 min',
        maxPassengers: pickupData.maxPassengers || 4,
      };
      // Store service info for later use
      window._pendingServiceInfo = serviceInfo;
    } else {
      toast.error("Invalid pickup or dropoff data format.");
      return;
    }

    if (!pickup || !dropoff) {
      toast.error("Pickup and dropoff locations are required.");
      return;
    }

    // Ensure pickup and dropoff have the required structure
    const pickupCoords = pickup.lat !== undefined ? pickup : { lat: pickup.lat, lng: pickup.lng };
    const dropoffCoords = dropoff.lat !== undefined ? dropoff : { lat: dropoff.lat, lng: dropoff.lng };

    if (pickupCoords.lat === undefined || pickupCoords.lng === undefined ||
        dropoffCoords.lat === undefined || dropoffCoords.lng === undefined) {
      toast.error("Invalid location coordinates.");
      return;
    }

    stopMovement();
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    setRouteData(null);
    setNavStats(null);

    const distance = calcDistance(pickupCoords, dropoffCoords);
    const fare     = calcFare(distance);

    // Get service info from pending or use defaults
    const serviceInfo = window._pendingServiceInfo || {
      serviceType: 'car',
      vehicleType: 'Car',
      fare: Math.round(fare),
      distance: distance.toFixed(2),
      estimatedTime: '5-8 min',
      maxPassengers: 4,
    };

    const newRide = {
      id:          uuid(),
      status:      RIDE_STATUS.REQUESTING,
      pickup:      pickupCoords,
      dropoff:     dropoffCoords,
      riderId:     "rider-001",
      riderName:   "You (Rider)",
      driverName:  null,
      vehicleType: serviceInfo.vehicleType || null,
      plate:       null,
      fare:        serviceInfo.fare || Math.round(fare),
      distance:    parseFloat(serviceInfo.distance) || +distance.toFixed(2),
      duration:    null,
      serviceType: serviceInfo.serviceType || 'car',
      estimatedTime: serviceInfo.estimatedTime || '5-8 min',
      maxPassengers: serviceInfo.maxPassengers || 4,
      createdAt:   new Date().toISOString(),
    };

    try {
      await writeRide(newRide);
      toast.success(`Looking for a driver... (${serviceInfo.serviceType})`, { duration: 3000 });
      startRideTimeout(newRide);

      // Pre-fetch routes in background
      const startPos = driverPosRef.current || randomKtmCoord();
      const [toPickup, toDropoff] = await Promise.all([
        fetchOsrmRoute(startPos, pickupCoords),
        fetchOsrmRoute(pickupCoords, dropoffCoords),
      ]);
      if (isMounted.current) setRouteData({ toPickup, toDropoff });
      
      // Clear pending service info
      window._pendingServiceInfo = null;
    } catch (err) {
      console.error("requestRide failed:", err);
      toast.error("Failed to request ride. Please try again.");
    }
  }, [stopMovement, clearRideTimeout, startRideTimeout, writeRide]);

  // CANCEL ride (rider cancels)
  const cancelRide = useCallback(async () => {
    if (!ride) return;
    stopMovement();
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    setRouteData(null);
    setNavStats(null);
    const updated = { ...ride, status: RIDE_STATUS.CANCELLED };
    await writeRide(updated);
    persistRide(updated);
    toast("Ride cancelled.", { icon: "🚫" });
  }, [ride, writeRide, stopMovement, clearRideTimeout, persistRide]);

  // ACCEPT ride (driver accepts)
  const acceptRide = useCallback(async () => {
    if (!ride) return;
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();

    const driverStart = driverPosRef.current || randomKtmCoord();
    const driverName  = pick(DRIVER_NAMES);
    const vehicleType = ride.vehicleType || pick(VEHICLE_TYPES);
    const plate       = pick(PLATES);

    const updated = {
      ...ride,
      status: RIDE_STATUS.ACCEPTED,
      driverName, vehicleType, plate, driverStart,
      acceptedAt: Date.now(),
    };

    await writeRide(updated);
    await writePos(driverStart);

    const distKm = calcDistance(driverStart, ride.pickup);
    const eta    = calculateRealTimeETA(driverStart, ride.pickup);
    updateNavStats({
      remainingM: Math.round(distKm * 1000),
      remainingS: eta?.totalSeconds || 0,
      progressT: 0,
      phase: "to_pickup",
    });

    toast.success(`✅ Ride accepted by ${driverName}! Heading to pickup…`, { duration: 4000 });

    const route = await fetchOsrmRoute(driverStart, ride.pickup);
    if (route?.waypoints?.length) {
      const durationMs  = (route.durationS || (distKm / 30) * 3600) * 1000;
      setRouteData((prev) => ({ ...prev, toPickup: route }));
      animateRoute(route.waypoints, durationMs, (pos, t, remSec) => {
        if (!isMounted.current) return;
        updateNavStats({
          remainingM: Math.round(route.distanceM * (1 - t)),
          remainingS: Math.round(remSec),
          progressT: t,
          phase: "to_pickup",
        });
      }, async () => {
        if (!isMounted.current) return;
        const arrived = { ...updated, status: RIDE_STATUS.ARRIVED };
        await writeRide(arrived);
        await writePos(ride.pickup);
        setNavStats(null);
        toast("📍 Driver arrived at pickup!", { icon: "📍" });
      });
    } else {
      animateLinear(driverStart, ride.pickup, (distKm / 30) * 3600 * 1000, async () => {
        if (!isMounted.current) return;
        const arrived = { ...updated, status: RIDE_STATUS.ARRIVED };
        await writeRide(arrived);
        await writePos(ride.pickup);
        setNavStats(null);
        toast("📍 Driver arrived at pickup!", { icon: "📍" });
      });
    }
  }, [ride, writeRide, writePos, calculateRealTimeETA, updateNavStats, clearRideTimeout, animateRoute, animateLinear]);

  // START ride (driver starts trip)
  const startRide = useCallback(async () => {
    if (!ride) return;
    const distKm  = calcDistance(ride.pickup, ride.dropoff);
    const eta     = calculateRealTimeETA(ride.pickup, ride.dropoff);
    const durationS = Math.max(120, (distKm / 30) * 3600);

    const updated = {
      ...ride,
      status: RIDE_STATUS.ACTIVE,
      startTime: Date.now(),
      estimatedDuration: durationS,
    };
    await writeRide(updated);
    await writePos(ride.pickup);

    updateNavStats({
      remainingM: Math.round(distKm * 1000),
      remainingS: eta?.totalSeconds || durationS,
      progressT: 0,
      phase: "to_dropoff",
    });

    toast.success(`🚗 Ride started! ETA: ${eta?.display || `${Math.round(durationS / 60)} min`}`, { duration: 4000 });

    const route = await fetchOsrmRoute(ride.pickup, ride.dropoff);
    if (route?.waypoints?.length) {
      const ms = (route.durationS || durationS) * 1000;
      setRouteData((prev) => ({ ...prev, toDropoff: route }));
      animateRoute(route.waypoints, ms, (pos, t, remSec) => {
        if (!isMounted.current) return;
        updateNavStats({
          remainingM: Math.round(route.distanceM * (1 - t)),
          remainingS: Math.round(remSec),
          progressT: t,
          phase: "to_dropoff",
        });
      }, async () => {
        if (!isMounted.current) return;
        const dur       = Math.round((Date.now() - updated.startTime) / 1000);
        const completed = { ...updated, status: RIDE_STATUS.COMPLETED, duration: dur };
        await writeRide(completed);
        persistRide(completed);
        setNavStats(null);
        toast.success("🎉 You've arrived! Ride complete!");
      });
    } else {
      animateLinear(ride.pickup, ride.dropoff, durationS * 1000, async () => {
        if (!isMounted.current) return;
        const dur       = Math.round((Date.now() - updated.startTime) / 1000);
        const completed = { ...updated, status: RIDE_STATUS.COMPLETED, duration: dur };
        await writeRide(completed);
        persistRide(completed);
        setNavStats(null);
        toast.success("🎉 You've arrived! Ride complete!");
      });
    }
  }, [ride, writeRide, writePos, calculateRealTimeETA, updateNavStats, animateRoute, animateLinear, persistRide]);

  // COMPLETE ride manually
  const completeRide = useCallback(async () => {
    if (!ride) return;
    stopMovement();
    const dur       = ride.startTime ? Math.round((Date.now() - ride.startTime) / 1000) : 0;
    const completed = { ...ride, status: RIDE_STATUS.COMPLETED, duration: dur };
    await writeRide(completed);
    persistRide(completed);
    setNavStats(null);
    toast.success("🎉 Ride completed!");
  }, [ride, writeRide, stopMovement, persistRide]);

  // REJECT ride (driver rejects)
  const rejectRide = useCallback(async () => {
    if (!ride) return;
    clearRideTimeout();
    const updated = { ...ride, status: RIDE_STATUS.REJECTED };
    await writeRide(updated);
    persistRide(updated);
    toast.error("Ride rejected.");
  }, [ride, writeRide, clearRideTimeout, persistRide]);

  // CLEAR ride (reset everything)
  const clearRide = useCallback(async () => {
    stopMovement();
    clearTimeout(noDriverTimer.current);
    clearRideTimeout();
    setRouteData(null);
    setNavStats(null);
    setRide(null);
    try {
      await remove(ref(db, "currentRide"));
      await remove(ref(db, "driverPosition"));
    } catch {}
  }, [stopMovement, clearRideTimeout]);

  // Subscribe to live driver position
  const subscribeToPosition = useCallback((listener) => {
    posListeners.current.add(listener);
    if (driverPosRef.current) listener(driverPosRef.current);
    return () => posListeners.current.delete(listener);
  }, []);

  const getCurrentPosition = useCallback(() => driverPosRef.current, []);

  // Map location click
  const handleMapLocationClick = useCallback((coords) => {
    if (!coords) return;
    // This will be handled by the RiderPanel
    if (window.handleMapLocationClick) {
      window.handleMapLocationClick(coords);
    }
  }, []);

  const isRideActive = ride && [
    RIDE_STATUS.ACCEPTED, RIDE_STATUS.ARRIVED, RIDE_STATUS.ACTIVE,
  ].includes(ride.status);

  // ── Context value ─────────────────────────────────────────────────────────────
  const value = {
    // State
    ride,
    driverPosition,
    routeData,
    navStats,
    history,
    historyLoading,
    lastHistoryUpdate,
    nearbyRides,
    isDriverNearby,
    mapSelectionMode,
    isRideActive,

    // Constants
    MAX_DRIVER_DISTANCE_KM: MAX_DRIVER_KM,
    MIN_DRIVER_DISTANCE_KM: MIN_DRIVER_KM,

    // Actions
    requestRide,
    cancelRide,
    acceptRide,
    startRide,
    completeRide,
    rejectRide,
    clearRide,

    // History
    loadHistory,
    refreshHistory,
    clearHistory,

    // Position
    subscribeToPosition,
    getCurrentPosition,

    // Map
    handleMapLocationClick,
    setMapSelectionMode,

    // Utilities
    calculateRealTimeETA,
    isDriverWithinRange,
    getFormattedDistance,
  };

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useRide must be used within a RideProvider");
  return ctx;
}