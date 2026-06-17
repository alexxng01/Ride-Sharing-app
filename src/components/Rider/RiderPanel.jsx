// src/components/Rider/RiderPanel.jsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Navigation, X, CheckCircle, Car,
  ArrowRight, Compass, History, Star, Loader, Crosshair,
  Bike, Coffee, Package, ShoppingBag,
} from "lucide-react";
import { useRide } from "../../store/RideContext";
import {
  RIDE_STATUS, RIDE_STATUS_LABELS, TERMINAL_STATES,
  calcDistance, calcFare,
} from "../../lib/rideStates";

// ── Service Type Configurations ───────────────────────────────────────────────
const SERVICE_TYPES = {
  bike: {
    id: 'bike',
    icon: '🚲',
    label: 'Bike Ride',
    baseFare: 50,
    perKm: 20,
    maxPassengers: 1,
    estTime: '3-5 min',
    vehicleType: 'Bike',
    color: 'brand',
    description: 'Fast & always available',
  },
  car: {
    id: 'car',
    icon: '🚗',
    label: 'Car Ride',
    baseFare: 100,
    perKm: 30,
    maxPassengers: 4,
    estTime: '5-8 min',
    vehicleType: 'Car',
    color: 'blue',
    description: 'Comfortable & spacious',
  },
  food: {
    id: 'food',
    icon: '🍕',
    label: 'Food Delivery',
    baseFare: 30,
    perKm: 15,
    maxPassengers: 0,
    estTime: '15-25 min',
    vehicleType: 'Bike',
    color: 'green',
    description: 'Order from nearby restaurants',
  },
  parcel: {
    id: 'parcel',
    icon: '📦',
    label: 'Parcel Delivery',
    baseFare: 40,
    perKm: 18,
    maxPassengers: 0,
    estTime: '10-20 min',
    vehicleType: 'Bike',
    color: 'purple',
    description: 'Instant delivery in the city',
  },
  bazaar: {
    id: 'bazaar',
    icon: '🛍️',
    label: 'Bazaar Shopping',
    baseFare: 60,
    perKm: 22,
    maxPassengers: 2,
    estTime: '10-15 min',
    vehicleType: 'Car',
    color: 'pink',
    description: 'Shop essentials',
  },
};

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const colorMap = {
    [RIDE_STATUS.REQUESTING]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    [RIDE_STATUS.PROCESSING]: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    [RIDE_STATUS.ACCEPTED]:   "bg-blue-500/20   text-blue-400   border-blue-500/30",
    [RIDE_STATUS.ARRIVED]:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
    [RIDE_STATUS.ACTIVE]:     "bg-brand-500/20  text-brand-400  border-brand-500/30",
    [RIDE_STATUS.COMPLETED]:  "bg-green-500/20  text-green-400  border-green-500/30",
    [RIDE_STATUS.CANCELLED]:  "bg-dark-600/50   text-dark-300   border-dark-500/30",
    [RIDE_STATUS.REJECTED]:   "bg-red-500/20    text-red-400    border-red-500/30",
    [RIDE_STATUS.NO_DRIVER]:  "bg-red-500/20    text-red-400    border-red-500/30",
  };
  const pulse = [RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING, RIDE_STATUS.ACTIVE].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colorMap[status] || ""}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />}
      {RIDE_STATUS_LABELS[status]}
    </span>
  );
}

// ── Kathmandu Valley Complete Location Database ──────────────────────────────
const KTM_LOCATIONS = {
  "Kathmandu": { lat: 27.7172, lng: 85.3240, address: "Kathmandu, Nepal" },
  "Lalitpur": { lat: 27.6744, lng: 85.3240, address: "Lalitpur, Nepal" },
  "Bhaktapur": { lat: 27.6722, lng: 85.4278, address: "Bhaktapur, Nepal" },
  "Thamel": { lat: 27.7188, lng: 85.3299, address: "Thamel, Kathmandu, Nepal" },
  "Durbar Square": { lat: 27.7074, lng: 85.3272, address: "Durbar Square, Kathmandu, Nepal" },
  "Pashupatinath": { lat: 27.7336, lng: 85.3361, address: "Pashupatinath, Kathmandu, Nepal" },
  "Boudhanath": { lat: 27.7215, lng: 85.3648, address: "Boudhanath, Kathmandu, Nepal" },
  "Swayambhunath": { lat: 27.7214, lng: 85.2935, address: "Swayambhunath, Kathmandu, Nepal" },
  "Patan": { lat: 27.6752, lng: 85.3232, address: "Patan, Lalitpur, Nepal" },
  "Jawalakhel": { lat: 27.6833, lng: 85.3376, address: "Jawalakhel, Lalitpur, Nepal" },
  "Imadol": { lat: 27.6580, lng: 85.3400, address: "Imadol, Lalitpur, Nepal" },
  "Airport": { lat: 27.7141, lng: 85.3593, address: "Tribhuvan International Airport, Kathmandu, Nepal" },
  "Koteshwor": { lat: 27.6742, lng: 85.3610, address: "Koteshwor, Kathmandu, Nepal" },
  "Gongabu": { lat: 27.7329, lng: 85.3009, address: "Gongabu, Kathmandu, Nepal" },
  "Balaju": { lat: 27.7265, lng: 85.3047, address: "Balaju, Kathmandu, Nepal" },
  "Kalanki": { lat: 27.6900, lng: 85.3020, address: "Kalanki, Kathmandu, Nepal" },
  "Baneshwor": { lat: 27.7000, lng: 85.3450, address: "Baneshwor, Kathmandu, Nepal" },
  "New Baneshwor": { lat: 27.7050, lng: 85.3500, address: "New Baneshwor, Kathmandu, Nepal" },
  "Putalisadak": { lat: 27.7100, lng: 85.3200, address: "Putalisadak, Kathmandu, Nepal" },
  "Basantapur": { lat: 27.7070, lng: 85.3270, address: "Basantapur, Kathmandu, Nepal" },
  "Chabahil": { lat: 27.7250, lng: 85.3500, address: "Chabahil, Kathmandu, Nepal" },
  "Ratna Park": { lat: 27.7100, lng: 85.3220, address: "Ratna Park, Kathmandu, Nepal" },
  "Garden of Dreams": { lat: 27.7120, lng: 85.3180, address: "Garden of Dreams, Kathmandu, Nepal" },
  "Narayanhiti Palace": { lat: 27.7150, lng: 85.3180, address: "Narayanhiti Palace, Kathmandu, Nepal" },
  "Tribhuvan University": { lat: 27.6800, lng: 85.2900, address: "Tribhuvan University, Kirtipur, Nepal" },
  "Kathmandu Mall": { lat: 27.7000, lng: 85.3350, address: "Kathmandu Mall, Kathmandu, Nepal" },
  "Civil Mall": { lat: 27.6950, lng: 85.3400, address: "Civil Mall, Kathmandu, Nepal" },
  "City Centre": { lat: 27.7050, lng: 85.3250, address: "City Centre, Kathmandu, Nepal" },
  "Durbar Marg": { lat: 27.7120, lng: 85.3200, address: "Durbar Marg, Kathmandu, Nepal" },
  "Teaching Hospital": { lat: 27.6860, lng: 85.2950, address: "Teaching Hospital, Maharajgunj, Kathmandu, Nepal" },
  "Norvic Hospital": { lat: 27.7180, lng: 85.3200, address: "Norvic Hospital, Kathmandu, Nepal" },
};

const ALL_LOCATIONS = Object.keys(KTM_LOCATIONS);
const POPULAR = ["Thamel", "Airport", "Durbar Square", "Pashupatinath", "Boudhanath", "Patan", "Bhaktapur"];

function nearestName(lat, lng) {
  let nearest = null, minD = Infinity;
  Object.entries(KTM_LOCATIONS).forEach(([name, c]) => {
    const d = Math.hypot(c.lat - lat, c.lng - lng);
    if (d < minD) { minD = d; nearest = name; }
  });
  return minD < 0.05 ? nearest : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function locationDisplay(loc) {
  if (!loc) return "Not selected";
  if (loc.lat && loc.lng) {
    for (const [name, c] of Object.entries(KTM_LOCATIONS)) {
      if (Math.abs(c.lat - loc.lat) < 0.01 && Math.abs(c.lng - loc.lng) < 0.01) return name;
    }
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  }
  return "Location selected";
}

// ── Service Banner Component ──────────────────────────────────────────────────
function ServiceBanner({ service, onClear }) {
  const serviceInfo = SERVICE_TYPES[service];
  if (!serviceInfo) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r from-${serviceInfo.color}-500/20 to-${serviceInfo.color}-600/20 border border-${serviceInfo.color}-500/30 rounded-xl p-3 flex items-center justify-between`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 bg-${serviceInfo.color}-500/20 rounded-xl flex items-center justify-center`}>
          <span className="text-2xl">{serviceInfo.icon}</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{serviceInfo.label}</p>
          <p className="text-dark-400 text-xs">{serviceInfo.description}</p>
        </div>
      </div>
      <button
        onClick={onClear}
        className="text-dark-400 hover:text-white transition-colors p-1"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

// ── Driver ETA card ────────────────────────────────────────────────────────────
function DriverETACard({ distanceKm, etaMin, etaSec }) {
  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Car size={14} className="text-blue-400" />
        <span className="text-blue-300 text-xs font-medium">Driver ETA</span>
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-blue-400 text-[10px]">En Route</span>
        </div>
      </div>
      <p className="text-white font-bold text-xl">
        {etaMin > 0 ? `${etaMin}m ` : ""}{etaSec}s
      </p>
      {distanceKm && <p className="text-dark-400 text-xs mt-1">🚗 {distanceKm} away</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RiderPanel() {
  const {
    ride, requestRide, cancelRide, clearRide,
    driverPosition, subscribeToPosition,
  } = useRide();

  // Service state - default to car
  const [serviceType, setServiceType] = useState('car');
  const serviceInfo = SERVICE_TYPES[serviceType] || SERVICE_TYPES.car;

  // Pickup = rider's live GPS (auto-detected, read-only)
  const [pickupCoords, setPickupCoords]   = useState(null);
  const [pickupLabel, setPickupLabel]     = useState("Detecting your location…");
  const [pickupAddress, setPickupAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState("loading");

  // Dropoff = chosen by the user
  const [dropoff, setDropoff]             = useState("");
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState("");

  const [liveDriverPos, setLiveDriverPos] = useState(null);
  const [recentDest, setRecentDest]       = useState([]);

  // ── Detect GPS on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setPickupLabel("GPS not available");
      setPickupAddress("Kathmandu, Nepal");
      setPickupCoords({ lat: 27.7172, lng: 85.3240 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickupCoords(c);
        const name = nearestName(c.lat, c.lng);
        setPickupLabel(name);
        const locationData = KTM_LOCATIONS[name];
        setPickupAddress(locationData?.address || `${name}, Nepal`);
        setLocationStatus("ok");
      },
      () => {
        setLocationStatus("error");
        setPickupLabel("Location unavailable — using Kathmandu centre");
        setPickupAddress("Kathmandu, Nepal");
        setPickupCoords({ lat: 27.7172, lng: 85.3240 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Load recent destinations from localStorage ─────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("namlo_recent_dest");
      if (saved) setRecentDest(JSON.parse(saved).slice(0, 5));
    } catch {}
  }, []);

  const saveRecent = (label) => {
    if (!label) return;
    const next = [label, ...recentDest.filter((l) => l !== label)].slice(0, 5);
    setRecentDest(next);
    localStorage.setItem("namlo_recent_dest", JSON.stringify(next));
  };

  // ── Subscribe to driver position ───────────────────────────────────────────
  useEffect(() => {
    if (!subscribeToPosition) return;
    const unsub = subscribeToPosition((pos) => { if (pos) setLiveDriverPos(pos); });
    return unsub;
  }, [subscribeToPosition]);

  // ── Dropoff helpers ────────────────────────────────────────────────────────
  const setDestination = (name) => {
    setDropoff(name);
    const locationData = KTM_LOCATIONS[name];
    if (locationData) {
      setDropoffCoords({ lat: locationData.lat, lng: locationData.lng });
      setDropoffAddress(locationData.address || `${name}, Nepal`);
    }
  };

  const handleDropoffInput = (e) => {
    const v = e.target.value;
    setDropoff(v);
    const locationData = KTM_LOCATIONS[v];
    if (locationData) {
      setDropoffCoords({ lat: locationData.lat, lng: locationData.lng });
      setDropoffAddress(locationData.address || `${v}, Nepal`);
    } else {
      setDropoffCoords(null);
      setDropoffAddress("");
    }
  };

  const clearDropoff = () => { 
    setDropoff(""); 
    setDropoffCoords(null);
    setDropoffAddress("");
  };

  // ── Trip estimates ─────────────────────────────────────────────────────────
  const tripDist  = pickupCoords && dropoffCoords ? calcDistance(pickupCoords, dropoffCoords) : 0;
  const tripFare  = tripDist ? Math.round(serviceInfo.baseFare + (tripDist * serviceInfo.perKm)) : 0;
  const tripTime  = tripDist ? Math.round(tripDist * 2.5) : 0;

  // ── Ride actions ───────────────────────────────────────────────────────────
  const canRequest = !!dropoffCoords && !!pickupCoords && (!ride || TERMINAL_STATES.has(ride.status));

  const handleRequest = async () => {
    // Double check coordinates
    if (!pickupCoords) {
      console.error("Pickup coordinates missing");
      return;
    }
    if (!dropoffCoords) {
      console.error("Dropoff coordinates missing");
      return;
    }

    try {
      // Format the ride data properly - using the format expected by requestRide
      const rideData = {
        pickup: {
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
          address: pickupAddress || pickupLabel,
        },
        dropoff: {
          lat: dropoffCoords.lat,
          lng: dropoffCoords.lng,
          address: dropoffAddress || dropoff,
        },
        serviceType: serviceType,
        vehicleType: serviceInfo.vehicleType,
        fare: tripFare,
        distance: tripDist.toFixed(1),
        estimatedTime: serviceInfo.estTime,
        maxPassengers: serviceInfo.maxPassengers,
      };
      
      console.log("Requesting ride with data:", rideData);
      await requestRide(rideData);
      saveRecent(dropoff);
    } catch (err) {
      console.error("Ride request failed:", err);
    }
  };

  const isTerminal = ride && TERMINAL_STATES.has(ride.status);
  const isActive   = ride && !isTerminal;

  // Driver distance for ETA
  const driverPos = liveDriverPos || driverPosition;
  const driverDistKm =
    ride?.status === RIDE_STATUS.ACCEPTED && driverPos && ride.pickup
      ? calcDistance(driverPos, ride.pickup)
      : null;
  const driverDistFmt = driverDistKm != null
    ? driverDistKm < 1 ? `${Math.round(driverDistKm * 1000)} m` : `${driverDistKm.toFixed(1)} km`
    : null;

  // Clear service selection
  const handleClearService = () => {
    setServiceType('car');
  };

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 bg-${serviceInfo.color}-500/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className="text-xl">{serviceInfo.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-none">
            {serviceInfo.label}
          </h2>
          <p className="text-dark-400 text-xs mt-0.5">
            {serviceInfo.description}
          </p>
        </div>
        {ride?.status && <StatusBadge status={ride.status} />}
      </div>

      {/* Service Banner */}
      <ServiceBanner 
        service={serviceType} 
        onClear={handleClearService}
      />

      <AnimatePresence mode="wait">

        {/* ── Booking form ─────────────────────────────────────────────── */}
        {(!ride || isTerminal) && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            {/* Terminal status message */}
            {isTerminal && (
              <div className={`rounded-xl p-3 text-sm border ${
                ride.status === RIDE_STATUS.COMPLETED
                  ? "bg-green-500/10 border-green-500/20 text-green-300"
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}>
                {ride.status === RIDE_STATUS.COMPLETED && (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>Ride completed! <strong>NPR {ride.fare}</strong> · {ride.distance} km</span>
                  </div>
                )}
                {ride.status === RIDE_STATUS.CANCELLED  && "Ride was cancelled."}
                {ride.status === RIDE_STATUS.REJECTED   && "Driver declined your request."}
                {ride.status === RIDE_STATUS.NO_DRIVER  && "No drivers available. Please try again."}
              </div>
            )}

            {/* Location inputs */}
            <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-4">

              {/* Pickup — auto GPS, read-only */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">Your Location (Auto)</span>
                </div>
                <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  locationStatus === "ok"    ? "bg-brand-500/10 border-brand-500/30" :
                  locationStatus === "error" ? "bg-red-500/10   border-red-500/30"   :
                                              "bg-dark-800 border-dark-700"
                }`}>
                  {locationStatus === "loading" && <Loader size={15} className="text-dark-400 animate-spin flex-shrink-0" />}
                  {locationStatus === "ok"      && <Crosshair size={15} className="text-brand-400 flex-shrink-0" />}
                  {locationStatus === "error"   && <MapPin    size={15} className="text-red-400   flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${locationStatus === "ok" ? "text-white" : "text-dark-400"}`}>
                      {pickupLabel}
                    </p>
                    {pickupCoords && (
                      <p className="text-dark-500 text-[10px] mt-0.5">
                        {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                  {locationStatus === "ok" && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400 text-[10px]">Live</span>
                    </div>
                  )}
                </div>
                {!pickupCoords && (
                  <p className="text-red-400 text-xs mt-1">⚠️ Location not detected. Please enable GPS.</p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 h-px bg-dark-700" />
                <ArrowRight size={12} className="text-dark-600" />
                <div className="flex-1 h-px bg-dark-700" />
              </div>

              {/* Dropoff — user input */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">Where To?</span>
                </div>
                <div className="flex items-center bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/30 transition-all">
                  <Navigation size={16} className="text-green-400 mr-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={dropoff}
                    onChange={handleDropoffInput}
                    placeholder="Enter destination"
                    className="flex-1 bg-transparent text-white text-sm placeholder-dark-500 outline-none"
                  />
                  {dropoff && (
                    <button onClick={clearDropoff} className="ml-2 text-dark-500 hover:text-dark-300 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {!dropoffCoords && dropoff && (
                  <p className="text-yellow-400 text-xs mt-1">⚠️ Location not found. Please select from suggestions.</p>
                )}
              </div>

              {/* Recent destinations */}
              {recentDest.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History size={12} className="text-dark-500" />
                    <span className="text-dark-500 text-[10px] uppercase tracking-wider">Recent</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentDest.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => setDestination(loc)}
                        className="text-[11px] px-3 py-1.5 bg-dark-800 rounded-full text-dark-300 hover:text-brand-400 hover:bg-dark-700 transition-colors border border-dark-700 flex items-center gap-1"
                      >
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
                  <span className="text-dark-500 text-[10px] uppercase tracking-wider">Popular</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setDestination(loc)}
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                        dropoff === loc
                          ? "bg-brand-500/20 text-brand-400 border-brand-500/40"
                          : "bg-dark-800 text-dark-300 hover:text-brand-400 hover:bg-dark-700 border-dark-700"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Service Info Bar */}
            <div className="bg-dark-800/30 border border-dark-700 rounded-xl p-3 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <p className="text-dark-400">Base Fare</p>
                <p className="text-white font-semibold">NPR {serviceInfo.baseFare}</p>
              </div>
              <div className="text-center">
                <p className="text-dark-400">Per Km</p>
                <p className="text-white font-semibold">NPR {serviceInfo.perKm}</p>
              </div>
              <div className="text-center">
                <p className="text-dark-400">Est. Time</p>
                <p className="text-white font-semibold">{serviceInfo.estTime}</p>
              </div>
            </div>

            {/* Trip estimate */}
            <AnimatePresence>
              {dropoffCoords && pickupCoords && tripDist > 0 && (
                <motion.div
                  key="estimate"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`bg-gradient-to-r from-${serviceInfo.color}-500/10 to-${serviceInfo.color}-600/10 border border-${serviceInfo.color}-500/20 rounded-xl p-4 overflow-hidden`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300 text-xs">Distance</span>
                    <span className="text-white font-semibold">{tripDist.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300 text-xs">Estimated Time</span>
                    <span className="text-white font-semibold">~{tripTime} min</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dark-700">
                    <span className="text-dark-300 text-xs">Fare Estimate</span>
                    <span className={`text-${serviceInfo.color}-400 font-bold text-lg`}>NPR {tripFare}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Book button */}
            <motion.button
              whileHover={{ scale: canRequest ? 1.02 : 1 }}
              whileTap={{ scale: canRequest ? 0.97 : 1 }}
              onClick={handleRequest}
              disabled={!canRequest}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                canRequest
                  ? `bg-gradient-to-r from-${serviceInfo.color}-500 to-${serviceInfo.color}-600 text-white shadow-lg shadow-${serviceInfo.color}-500/25 hover:shadow-${serviceInfo.color}-500/40`
                  : "bg-dark-700 text-dark-500 cursor-not-allowed"
              }`}
            >
              {!pickupCoords
                ? "Detecting your location..."
                : !dropoffCoords
                ? "Choose a destination to continue"
                : isTerminal
                ? `Book Another ${serviceInfo.label}`
                : `${serviceInfo.icon} Book ${serviceInfo.label}`}
            </motion.button>

            {isTerminal && (
              <button onClick={clearRide} className="w-full py-2 text-xs text-dark-400 hover:text-dark-200 transition-colors">
                Clear
              </button>
            )}
          </motion.div>
        )}

        {/* ── Active ride view ──────────────────────────────────────────── */}
        {isActive && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            {/* Driver card */}
            <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-${serviceInfo.color}-500/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xl">{serviceInfo.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {ride.driverName || "Looking for a driver…"}
                  </p>
                  <p className="text-dark-400 text-xs truncate">
                    {ride.vehicleType ? `${ride.vehicleType} · ${ride.plate}` : "Matching you with a driver"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-dark-700/50 rounded-lg p-2">
                  <p className="text-dark-500 text-xs mb-0.5">Service</p>
                  <p className="text-white font-medium text-sm">{serviceInfo.label}</p>
                </div>
                <div className="bg-dark-700/50 rounded-lg p-2">
                  <p className="text-dark-500 text-xs mb-0.5">Fare</p>
                  <p className={`text-${serviceInfo.color}-400 font-semibold text-sm`}>NPR {ride.fare}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-500 mt-1 flex-shrink-0" />
                  <span className="text-dark-300 break-words flex-1">Pickup · {pickupLabel}</span>
                </div>
                <div className="w-px h-3 bg-dark-600 ml-1" />
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                  <span className="text-dark-300 break-words flex-1">Dropoff · {dropoff || locationDisplay(ride.dropoff)}</span>
                </div>
              </div>
            </div>

            {/* Driver ETA */}
            {ride.status === RIDE_STATUS.ACCEPTED && driverDistKm != null && (
              <DriverETACard
                distanceKm={driverDistFmt}
                etaMin={Math.floor(driverDistKm * 2)}
                etaSec={Math.round((driverDistKm * 2 * 60) % 60)}
              />
            )}

            {/* Cancel button */}
            {[RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING, RIDE_STATUS.ACCEPTED].includes(ride.status) && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={cancelRide}
                className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
              >
                <X size={14} /> Cancel Ride
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}