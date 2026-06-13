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

  const generateNearbyRides = useCallback((currentDriverPos) => {
    if (!currentDriverPos) {
      setNearbyRides([]);
      setIsDriverNearby(false);
      return;
    }

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

      if (distanceToPickup <= MAX_DRIVER_DISTANCE_KM) {
        const distance = calcDistance(pickup, dropoff);
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

  const persistRide = useCallback(async (rideData) => {
    if (!isMounted.current) return;

    const historyEntry = {
      rideId:      rideData.id,
      riderId:     rideData.riderId,
      riderName:   rideData.riderName,
      driverName:  rideData.driverName  || "N/A",
      vehicleType: rideData.vehicleType || "N/A",
      plate:       rideData.plate       || "N/A",
      pickup:      `${rideData.pickup.lat.toFixed(4)}, ${rideData.pickup.lng.toFixed(4)}`,
      dropoff:     `${rideData.dropoff.lat.toFixed(4)}, ${rideData.dropoff.lng.toFixed(4)}`,
      status:      rideData.status,
      fare:        rideData.fare,
      distance:    rideData.distance,
      duration:    rideData.duration || 0,
      createdAt:   rideData.createdAt,
      completedAt: rideData.status === RIDE_STATUS.COMPLETED ? new Date().toISOString() : null,
    };

    setPendingHistoryUpdates(prev => [...prev, historyEntry]);
  }, []);

  const processPendingUpdates = useCallback(async () => {
    const updates = [...pendingHistoryUpdates];
    setPendingHistoryUpdates([]);

    for (const rideData of updates) {
      try {
        await rideHistoryApi.create(rideData);
        if (isMounted.current) {
          toast.success("Ride saved to history!", { icon: "📜" });
        }
      } catch (e) {
        console.warn("History persist failed:", e);
        if (isMounted.current) {
          setPendingHistoryUpdates(prev => [...prev, rideData]);
        }
      }
    }

    if (updates.length > 0 && isMounted.current) {
      await loadHistory(true);
    }
  }, [pendingHistoryUpdates, loadHistory]);

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

    if (!waypoints?.length) {
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

    let step = 0;
    const startTime = Date.now();

    moveInterval.current = setInterval(async () => {
      step++;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);
      const pos = interpolate(from, to, t);
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
    if (pendingHistoryUpdates.length > 0 && !historyLoading) {
      processPendingUpdates();
    }
  }, [pendingHistoryUpdates, historyLoading, processPendingUpdates]);

  useEffect(() => {
    isMounted.current = true;

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
    };
  }, [notifyPositionListeners, initializeNavStats, startRideTimeout, clearRideTimeout, generateNearbyRides]);

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
    await remove(ref(db, "currentRide"));
    await remove(ref(db, "driverPosition"));
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
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
      setPendingHistoryUpdates([]);
      toast.success("History cleared locally");
    }
  }, []);

  const handleMapLocationClick = useCallback((coords) => {}, []);

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