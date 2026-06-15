// src/components/Rider/RiderPanel.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, X, CheckCircle, Clock, DollarSign, Car, Eye, ArrowUp, ArrowDown, Search, ArrowRight, Map, ChevronRight, Home, Building, Compass, Crosshair, Navigation2, History, Star, Loader } from "lucide-react";
import toast from "react-hot-toast";
import { useRide } from "../../store/RideContext";
import { RIDE_STATUS, RIDE_STATUS_LABELS, TERMINAL_STATES, calcDistance, calcFare } from "../../lib/rideStates";

function StatusBadge({ status }) {
  const colorMap = {
    [RIDE_STATUS.REQUESTING]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    [RIDE_STATUS.PROCESSING]: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    [RIDE_STATUS.ACCEPTED]:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
    [RIDE_STATUS.ARRIVED]:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
    [RIDE_STATUS.ACTIVE]:     "bg-brand-500/20 text-brand-400 border-brand-500/30",
    [RIDE_STATUS.COMPLETED]:  "bg-green-500/20 text-green-400 border-green-500/30",
    [RIDE_STATUS.CANCELLED]:  "bg-dark-600/50 text-dark-300 border-dark-500/30",
    [RIDE_STATUS.REJECTED]:   "bg-red-500/20 text-red-400 border-red-500/30",
    [RIDE_STATUS.NO_DRIVER]:  "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const pulse = [RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING, RIDE_STATUS.ACTIVE].includes(status);

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colorMap[status] || ""}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping-slow" />}
      {RIDE_STATUS_LABELS[status]}
    </span>
  );
}

const formatDistance = (km) => {
  if (!km && km !== 0) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
};

// Kathmandu Valley locations
const KTM_VALLEY_LOCATIONS = {
  "Kathmandu":       { lat: 27.7172, lng: 85.3240, area: "Kathmandu",  type: "city",        popularity: 10 },
  "Lalitpur":        { lat: 27.6744, lng: 85.3240, area: "Lalitpur",   type: "city",        popularity: 9  },
  "Bhaktapur":       { lat: 27.6722, lng: 85.4278, area: "Bhaktapur",  type: "city",        popularity: 8  },
  "Thamel":          { lat: 27.7188, lng: 85.3299, area: "Kathmandu",  type: "tourist",     popularity: 10 },
  "Durbar Square":   { lat: 27.7074, lng: 85.3272, area: "Kathmandu",  type: "heritage",    popularity: 9  },
  "Pashupatinath":   { lat: 27.7336, lng: 85.3361, area: "Kathmandu",  type: "religious",   popularity: 9  },
  "Boudhanath":      { lat: 27.7215, lng: 85.3648, area: "Kathmandu",  type: "heritage",    popularity: 8  },
  "Swayambhunath":   { lat: 27.7214, lng: 85.2935, area: "Kathmandu",  type: "heritage",    popularity: 8  },
  "Patan":           { lat: 27.6752, lng: 85.3232, area: "Lalitpur",   type: "city",        popularity: 8  },
  "Jawalakhel":      { lat: 27.6833, lng: 85.3376, area: "Lalitpur",   type: "residential", popularity: 7  },
  "Imadol":          { lat: 27.6580, lng: 85.3400, area: "Lalitpur",   type: "residential", popularity: 6  },
  "Bojapokhari":     { lat: 27.6750, lng: 85.3300, area: "Lalitpur",   type: "residential", popularity: 6  },
  "Airport":         { lat: 27.7141, lng: 85.3593, area: "Kathmandu",  type: "transport",   popularity: 8  },
};

const findNearestLocationName = (lat, lng) => {
  let nearest = null;
  let minDist = Infinity;
  Object.entries(KTM_VALLEY_LOCATIONS).forEach(([name, data]) => {
    const d = Math.sqrt(Math.pow(data.lat - lat, 2) + Math.pow(data.lng - lng, 2));
    if (d < minDist) { minDist = d; nearest = name; }
  });
  if (minDist < 0.05) return nearest;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

// Scroll Buttons Component
function ScrollButtons({ containerRef }) {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setShowTop(scrollTop > 100);
      setShowBottom(scrollTop + clientHeight < scrollHeight - 100);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      checkScroll();
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, []);

  return (
    <div className="absolute right-2 bottom-20 flex flex-col gap-2 z-10">
      {showTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-8 h-8 bg-brand-500/80 hover:bg-brand-500 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all"
        >
          <ArrowUp size={14} className="text-white" />
        </motion.button>
      )}
      {showBottom && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })}
          className="w-8 h-8 bg-brand-500/80 hover:bg-brand-500 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all"
        >
          <ArrowDown size={14} className="text-white" />
        </motion.button>
      )}
    </div>
  );
}

// Driver ETA Display Component
function DriverETADisplay({ distanceKm, etaMinutes, etaSeconds, isEnRoute }) {
  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Car size={14} className="text-blue-400" />
        <span className="text-blue-300 text-xs font-medium">Driver ETA</span>
        {isEnRoute && (
          <div className="flex items-center gap-1 ml-auto">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-400 text-[10px]">En Route</span>
          </div>
        )}
      </div>
      <p className="text-white font-bold text-xl">{etaMinutes > 0 ? `${etaMinutes}m ` : ''}{etaSeconds}s</p>
      {distanceKm && <p className="text-dark-400 text-xs mt-1">🚗 {distanceKm} away</p>}
    </div>
  );
}

export default function RiderPanel() {
  const {
    ride, requestRide, cancelRide, clearRide, driverPosition, navStats,
    subscribeToPosition,
    mapSelectedPickup, mapSelectedDropoff, resetMapSelection,
  } = useRide();

  // Pickup is always the rider's live GPS location
  const [pickupCoords, setPickupCoords]     = useState(null);
  const [pickupLabel, setPickupLabel]       = useState("Detecting your location…");
  const [locationStatus, setLocationStatus] = useState("loading"); // "loading" | "ok" | "error"

  // Only dropoff is chosen by the user
  const [dropoff, setDropoff]           = useState("");
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const [currentDriverPos, setCurrentDriverPos] = useState(null);
  const [recentLocations, setRecentLocations]   = useState([]);

  const scrollContainerRef = useRef(null);

  // ── Auto-detect rider's GPS on mount ────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setPickupLabel("GPS not available");
      // Fallback to Kathmandu centre
      setPickupCoords({ lat: 27.7172, lng: 85.3240 });
      toast.error("GPS unavailable — using Kathmandu centre as fallback.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickupCoords(coords);
        setPickupLabel(findNearestLocationName(coords.lat, coords.lng));
        setLocationStatus("ok");
      },
      (err) => {
        setLocationStatus("error");
        setPickupLabel("Location unavailable");
        // Fallback to Kathmandu centre
        setPickupCoords({ lat: 27.7172, lng: 85.3240 });
        // Inform the user — silent fallback was a common source of "my pickup
        // is in the wrong place" support tickets.
        if (err && err.code === err.PERMISSION_DENIED) {
          toast.error("Location permission denied. Using Kathmandu centre — enable location in your browser for accurate pickup.");
        } else if (err && err.code === err.TIMEOUT) {
          toast.error("Location request timed out. Using Kathmandu centre as fallback.");
        } else {
          toast.error("Couldn't get your location. Using Kathmandu centre as fallback.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Load recent locations ────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('recentRideLocations');
    if (saved) {
      try { setRecentLocations(JSON.parse(saved).slice(0, 5)); } catch(e) {}
    }
  }, []);

  const saveToRecent = (label) => {
    if (!label) return;
    const updated = [label, ...recentLocations.filter(l => l !== label)].slice(0, 5);
    setRecentLocations(updated);
    localStorage.setItem('recentRideLocations', JSON.stringify(updated));
  };

  // ── Subscribe to driver position ─────────────────────────────────────────────
  useEffect(() => {
    if (subscribeToPosition) {
      const unsub = subscribeToPosition((pos) => { if (pos) setCurrentDriverPos(pos); });
      return () => unsub();
    }
  }, [subscribeToPosition]);

  // ── Sync map-selected dropoff into the booking form ──────────────────────────
  // Map-tab toolbar writes into RideContext.mapSelectedDropoff; when it changes,
  // bring it into our local form state so the rider can review and book.
  useEffect(() => {
    if (!mapSelectedDropoff) return;
    const lat = Number(mapSelectedDropoff.lat);
    const lng = Number(mapSelectedDropoff.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Try to find a known destination name within ~1km; otherwise show coords.
    let matchedName = null;
    for (const [name, data] of Object.entries(KTM_VALLEY_LOCATIONS)) {
      const dKm = calcDistance({ lat, lng }, data);
      if (Number.isFinite(dKm) && dKm < 1) { matchedName = name; break; }
    }
    setDropoffCoords(mapSelectedDropoff);
    setDropoff(matchedName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  }, [mapSelectedDropoff]);

  // ── Map-selected pickup overrides GPS pickup ─────────────────────────────────
  useEffect(() => {
    if (!mapSelectedPickup) return;
    const lat = Number(mapSelectedPickup.lat);
    const lng = Number(mapSelectedPickup.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPickupCoords(mapSelectedPickup);
    setPickupLabel(findNearestLocationName(lat, lng));
    setLocationStatus("ok");
  }, [mapSelectedPickup]);

  // ── Dropoff selection ────────────────────────────────────────────────────────
  const handleDropoffChange = (e) => {
    const value = e.target.value;
    setDropoff(value);
    setDropoffCoords(KTM_VALLEY_LOCATIONS[value] || null);
  };

  const selectDropoff = (name) => {
    setDropoff(name);
    setDropoffCoords(KTM_VALLEY_LOCATIONS[name] || null);
  };

  // ── Trip calculations ────────────────────────────────────────────────────────
  const tripDistance    = pickupCoords && dropoffCoords ? calcDistance(pickupCoords, dropoffCoords) : 0;
  const estimatedFare   = tripDistance ? Math.round(tripDistance * 30 + 50) : 0;
  const estimatedTime   = tripDistance ? Math.round(tripDistance * 2.5) : 0;

  const canRequest = !!dropoffCoords && !!pickupCoords && (!ride || TERMINAL_STATES.has(ride.status));

  const handleRequest = async () => {
    if (!pickupCoords || !dropoffCoords) return;
    await requestRide(pickupCoords, dropoffCoords);
    saveToRecent(dropoff);
    // Once the ride is booked, the "set on map" preview is no longer useful —
    // the booking now drives pickup/dropoff via Firebase.
    resetMapSelection();
  };

  const isTerminal = ride && TERMINAL_STATES.has(ride.status);
  const isActive   = ride && !isTerminal;
  const driverPos  = currentDriverPos || driverPosition;

  const distanceToDriver = ride?.status === RIDE_STATUS.ACCEPTED && driverPos && ride.pickup
    ? calcDistance(driverPos, ride.pickup) : null;
  const distanceToDriverFormatted = distanceToDriver ? formatDistance(distanceToDriver) : null;

  const popularDestinations = ["Thamel", "Airport", "Durbar Square", "Pashupatinath", "Boudhanath", "Patan", "Bhaktapur"];

  const getRideLocationDisplay = (location) => {
    if (!location) return "Not selected";
    if (location.lat && location.lng) {
      for (const [name, data] of Object.entries(KTM_VALLEY_LOCATIONS)) {
        if (Math.abs(data.lat - location.lat) < 0.01 && Math.abs(data.lng - location.lng) < 0.01) return name;
      }
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    return "Location selected";
  };

  return (
    <div className="relative w-full h-full">
      <div ref={scrollContainerRef} className="flex flex-col gap-4 overflow-y-auto h-full pr-2 custom-scrollbar">

        {/* Header */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center">
            <Navigation className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h2 className="text-white font-display font-bold text-lg leading-none">Request a Ride</h2>
            <p className="text-dark-400 text-xs mt-0.5">Book a ride anywhere in Kathmandu Valley</p>
          </div>
          {ride?.status && <div className="ml-auto"><StatusBadge status={ride.status} /></div>}
        </div>

        <div className="w-full">
          <AnimatePresence mode="wait">

            {/* ── Booking form ── */}
            {(!ride || isTerminal) && (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 w-full">

                {isTerminal && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-xl p-3 text-sm border ${ride.status === RIDE_STATUS.COMPLETED ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                    {ride.status === RIDE_STATUS.COMPLETED && (<div className="flex items-center gap-2"><CheckCircle size={16} /><span>Ride completed! <strong>NPR {ride.fare}</strong> · {ride.distance} km</span></div>)}
                    {ride.status === RIDE_STATUS.CANCELLED && "Ride was cancelled."}
                    {ride.status === RIDE_STATUS.REJECTED  && "Driver declined your request."}
                    {ride.status === RIDE_STATUS.NO_DRIVER && "No drivers available. Try again."}
                  </motion.div>
                )}

                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-4">

                  {/* ── Pickup — live GPS, read-only ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-brand-500" />
                      <span className="text-dark-400 text-xs font-medium">YOUR LOCATION (AUTO)</span>
                    </div>
                    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                      locationStatus === "ok"      ? "bg-brand-500/10 border-brand-500/30" :
                      locationStatus === "error"   ? "bg-red-500/10 border-red-500/30" :
                                                     "bg-dark-800 border-dark-700"
                    }`}>
                      {locationStatus === "loading" ? (
                        <Loader size={15} className="text-dark-400 animate-spin flex-shrink-0" />
                      ) : locationStatus === "ok" ? (
                        <Crosshair size={15} className="text-brand-400 flex-shrink-0" />
                      ) : (
                        <MapPin size={15} className="text-red-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          locationStatus === "ok" ? "text-white" : "text-dark-400"
                        }`}>{pickupLabel}</p>
                        {locationStatus === "ok" && pickupCoords && (
                          <p className="text-dark-500 text-[10px] mt-0.5">
                            {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}
                          </p>
                        )}
                        {locationStatus === "error" && (
                          <p className="text-red-400/70 text-[10px] mt-0.5">Using Kathmandu centre as fallback</p>
                        )}
                      </div>
                      {locationStatus === "ok" && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-green-400 text-[10px]">Live</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider arrow */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 h-px bg-dark-700" />
                    <ArrowRight size={12} className="text-dark-600" />
                    <div className="flex-1 h-px bg-dark-700" />
                  </div>

                  {/* ── Dropoff — user chooses ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRight size={12} className="text-dark-500" />
                      <span className="text-dark-400 text-xs font-medium">WHERE TO?</span>
                    </div>
                    <div className="flex items-center bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/50 transition-all">
                      <Navigation size={16} className="text-green-400 mr-3 flex-shrink-0" />
                      <input
                        type="text"
                        value={dropoff}
                        onChange={handleDropoffChange}
                        placeholder="Enter destination"
                        className="flex-1 bg-transparent text-white text-sm placeholder-dark-500 outline-none"
                      />
                      {dropoff && (
                        <button onClick={() => { setDropoff(""); setDropoffCoords(null); }} className="ml-2 text-dark-500 hover:text-dark-300">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recent destinations */}
                  {recentLocations.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <History size={12} className="text-dark-500" />
                        <span className="text-dark-500 text-[10px] uppercase tracking-wider">Recent</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentLocations.map((loc) => (
                          <button key={loc} onClick={() => selectDropoff(loc)}
                            className="text-[11px] px-3 py-1.5 bg-dark-800 rounded-full text-dark-300 hover:text-brand-400 hover:bg-dark-700 transition-colors border border-dark-700 flex items-center gap-1">
                            <Star size={10} className="text-yellow-500" />{loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular destinations */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Compass size={12} className="text-brand-400" />
                      <span className="text-dark-500 text-[10px] uppercase tracking-wider">Popular Destinations</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {popularDestinations.map((loc) => (
                        <button key={loc} onClick={() => selectDropoff(loc)}
                          className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                            dropoff === loc
                              ? "bg-brand-500/20 text-brand-400 border-brand-500/40"
                              : "bg-dark-800 text-dark-300 hover:text-brand-400 hover:bg-dark-700 border-dark-700"
                          }`}>
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trip estimate */}
                {dropoffCoords && pickupCoords && tripDistance > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="bg-gradient-to-r from-brand-500/10 to-orange-600/10 border border-brand-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-dark-300 text-xs">Distance</span>
                      <span className="text-white font-semibold">{tripDistance.toFixed(1)} km</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-dark-300 text-xs">Estimated Time</span>
                      <span className="text-white font-semibold">~{estimatedTime} min</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-dark-700">
                      <span className="text-dark-300 text-xs">Fare Estimate</span>
                      <span className="text-brand-400 font-bold text-lg">NPR {estimatedFare}</span>
                    </div>
                  </motion.div>
                )}

                {/* Book button */}
                <motion.button
                  whileHover={{ scale: canRequest ? 1.02 : 1 }}
                  whileTap={{ scale: canRequest ? 0.97 : 1 }}
                  onClick={handleRequest}
                  disabled={!canRequest}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                    canRequest
                      ? "bg-gradient-to-r from-brand-500 to-orange-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40"
                      : "bg-dark-700 text-dark-500 cursor-not-allowed"
                  }`}>
                  {!dropoffCoords ? "Choose a destination" : isTerminal ? "Book Another Ride" : "Book Ride"}
                </motion.button>

                {isTerminal && (
                  <button onClick={clearRide} className="w-full py-2 text-xs text-dark-400 hover:text-dark-200 transition-colors">Clear</button>
                )}
              </motion.div>
            )}

            {/* ── Active ride view ── */}
            {isActive && (
              <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3 w-full pb-4">
                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-3 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{ride.driverName || "Looking for driver…"}</p>
                      <p className="text-dark-400 text-xs truncate">{ride.vehicleType ? `${ride.vehicleType} · ${ride.plate}` : "Matching you with a driver"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-dark-700/50 rounded-lg p-2">
                      <p className="text-dark-500 mb-0.5 text-xs">Distance</p>
                      <p className="text-white font-medium">{ride.distance} km</p>
                    </div>
                    <div className="bg-dark-700/50 rounded-lg p-2">
                      <p className="text-dark-500 mb-0.5 text-xs">Fare</p>
                      <p className="text-brand-400 font-semibold">NPR {ride.fare}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1" />
                      <span className="text-dark-300 break-words flex-1">Pickup · {getRideLocationDisplay(ride.pickup)}</span>
                    </div>
                    <div className="w-px h-3 bg-dark-600 ml-1" />
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1" />
                      <span className="text-dark-300 break-words flex-1">Dropoff · {getRideLocationDisplay(ride.dropoff)}</span>
                    </div>
                  </div>
                </div>

                {ride.status === RIDE_STATUS.ACCEPTED && distanceToDriverFormatted && (
                  <DriverETADisplay
                    distanceKm={distanceToDriverFormatted}
                    etaMinutes={Math.floor(distanceToDriver * 2)}
                    etaSeconds={Math.floor((distanceToDriver * 2 * 60) % 60)}
                    isEnRoute={true}
                  />
                )}

                {[RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING, RIDE_STATUS.ACCEPTED].includes(ride.status) && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={cancelRide}
                    className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                    <X size={14} />Cancel Ride
                  </motion.button>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
      <ScrollButtons containerRef={scrollContainerRef} />
    </div>
  );
}