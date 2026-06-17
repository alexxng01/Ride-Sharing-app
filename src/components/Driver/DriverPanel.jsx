// src/components/Driver/DriverPanel.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  CheckCircle,
  XCircle,
  Play,
  MapPin,
  Navigation,
  AlertCircle,
  Clock,
  Banknote,
  Star,
  TrendingUp,
  CircleDot,
  ArrowRight,
  Eye,
  ArrowUp,
  ArrowDown,
  Target,
  Gauge,
  Timer,
} from "lucide-react";
import { useRide } from "../../store/RideContext";
import { RIDE_STATUS, TERMINAL_STATES } from "../../lib/rideStates";

// Nepal locations mapping for reverse geocoding
const NEPAL_LOCATIONS_MAP = {
  "27.7172,85.3240": "Kathmandu",
  "27.6744,85.3240": "Lalitpur",
  "27.6722,85.4278": "Bhaktapur",
  "27.7188,85.3299": "Thamel",
  "27.7074,85.3272": "Durbar Square",
  "27.7214,85.2935": "Swayambhunath",
  "27.7215,85.3648": "Boudhanath",
  "27.7336,85.3361": "Pashupatinath",
  "27.6752,85.3232": "Patan Durbar Square",
  "27.6580,85.3400": "Imadol",
  "27.6750,85.3300": "Bojapokhari",
  "27.6650,85.3200": "Satdobato",
  "27.6700,85.3200": "Lagankhel",
};

const getLocationNameFromCoords = (lat, lng) => {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const exactMatch = NEPAL_LOCATIONS_MAP[key];
  if (exactMatch) return exactMatch;

  let closestMatch = null;
  let minDistance = Infinity;

  Object.keys(NEPAL_LOCATIONS_MAP).forEach((coordKey) => {
    const [coordLat, coordLng] = coordKey.split(",").map(Number);
    const distance = Math.sqrt(
      Math.pow(coordLat - lat, 2) + Math.pow(coordLng - lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = NEPAL_LOCATIONS_MAP[coordKey];
    }
  });

  if (minDistance < 0.01 && closestMatch) return closestMatch;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

function InfoRow({ label, value, accent, large }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dark-400 text-xs">{label}</span>
      <span
        className={`font-semibold ${large ? "text-base" : "text-sm"} ${
          accent ? "text-brand-400" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RideTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span>
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

function NavStrip({ navStats }) {
  if (!navStats) return null;
  const distKm =
    navStats.remainingM >= 1000
      ? `${(navStats.remainingM / 1000).toFixed(1)} km`
      : `${navStats.remainingM} m`;
  const etaSec = navStats.remainingS;
  const eta =
    etaSec < 60 ? `${etaSec}s` : `${Math.floor(etaSec / 60)}m ${etaSec % 60}s`;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-dark-700/60 rounded-xl p-3 text-center">
        <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-0.5">
          Remaining
        </p>
        <p className="text-white font-bold text-base">{distKm}</p>
      </div>
      <div className="bg-dark-700/60 rounded-xl p-3 text-center">
        <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-0.5">
          ETA
        </p>
        <p className="text-white font-bold text-base">{eta}</p>
      </div>
    </div>
  );
}

const STEPS = [
  { key: RIDE_STATUS.ACCEPTED, label: "En Route" },
  { key: RIDE_STATUS.ARRIVED,  label: "Arrived"  },
  { key: RIDE_STATUS.ACTIVE,   label: "Active"   },
  { key: RIDE_STATUS.COMPLETED,label: "Done"     },
];

function ProgressSteps({ status }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center justify-between px-1">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                i < idx
                  ? "bg-green-500 border-green-500 text-white"
                  : i === idx
                  ? "bg-brand-500 border-brand-500 text-white animate-pulse"
                  : "bg-dark-800 border-dark-600 text-dark-500"
              }`}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span
              className={`text-[9px] font-medium ${
                i <= idx ? "text-white" : "text-dark-600"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all ${
                i < idx ? "bg-green-500" : "bg-dark-700"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Draggable Payment Modal ──────────────────────────────────────────────────
function DraggablePaymentModal({ ride, onClear }) {
  const [paid, setPaid] = useState(false);

  // Drag state
  const modalRef  = useRef(null);
  const dragging  = useRef(false);
  const offset    = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 16, y: null }); // null y = use bottom:16 initially

  // ── pointer helpers ──
  const getXY = (e) =>
    e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
              : { x: e.clientX,            y: e.clientY            };

  const onDragStart = (e) => {
    // Don't start drag on interactive children
    if (e.target.closest("button") || e.target.closest("select")) return;
    dragging.current = true;
    const rect = modalRef.current.getBoundingClientRect();
    const { x, y } = getXY(e);
    offset.current = { x: x - rect.left, y: y - rect.top };
    e.preventDefault?.();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const { x, y } = getXY(e);
      const newX = Math.max(0, Math.min(window.innerWidth  - (modalRef.current?.offsetWidth  || 0), x - offset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - (modalRef.current?.offsetHeight || 0), y - offset.current.y));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { dragging.current = false; };

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("touchmove",  onMove, { passive: false });
    window.addEventListener("touchend",   onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onUp);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div
        ref={modalRef}
        className="pointer-events-auto w-full max-w-sm bg-dark-900 rounded-3xl shadow-2xl overflow-hidden"
        style={{
          position:  "fixed",
          left:      pos.x,
          top:       pos.y !== null ? pos.y : undefined,
          bottom:    pos.y === null ? 16    : undefined,
          maxHeight: "90vh",
          overflowY: "auto",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* ── Drag handle ── */}
        <div
          className="flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <div className="w-10 h-1 bg-dark-600 rounded-full" />
          <p className="text-dark-500 text-[10px] mt-1 select-none">
            drag to move
          </p>
        </div>

        {/* ── Payment content ── */}
        <div className="px-4 pb-4 space-y-4">
          <div className="bg-gradient-to-b from-green-500/10 to-dark-800/80 border border-green-500/25 rounded-2xl p-4 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-green-400 font-bold text-base">Ride Completed!</p>
              <p className="text-dark-400 text-xs mt-0.5">Payment Summary</p>
            </div>

            <div className="bg-green-500/15 border border-green-500/30 rounded-xl py-4 text-center">
              <p className="text-dark-400 text-xs mb-1">Total Fare</p>
              <p className="text-green-400 font-black text-3xl">NPR {ride.fare}</p>
            </div>

            <div className="space-y-2.5">
              <InfoRow label="Distance" value={`${ride.distance} km`} />
              <InfoRow
                label="Duration"
                value={`${Math.floor((ride.duration || 0) / 60)}m ${(ride.duration || 0) % 60}s`}
              />
              <InfoRow label="Vehicle" value={ride.vehicleType || "—"} />
              <InfoRow label="Plate"   value={ride.plate       || "—"} />
              <div className="border-t border-dark-700 pt-2">
                <InfoRow label="Base Fare" value="NPR 50" />
                <InfoRow
                  label="Per km"
                  value={`NPR ${Math.round((ride.fare - 50) / Math.max(ride.distance, 1))}/km`}
                />
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <p className="text-dark-400 text-xs">Rate your rider</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className="text-2xl hover:scale-110 transition-transform">
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!paid ? (
            <div className="space-y-2">
              <p className="text-dark-400 text-xs text-center">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                {["Cash", "eSewa"].map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaid(true)}
                    className="py-2.5 rounded-xl border border-dark-600 text-sm text-dark-300 hover:border-green-500/50 hover:text-green-400 hover:bg-green-500/5 transition-all font-medium"
                  >
                    {method === "Cash" ? "💵" : "📱"} {method}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/10 border border-green-500/30 rounded-xl py-3 text-center text-green-400 font-semibold text-sm"
            >
              ✅ Payment confirmed!
            </motion.div>
          )}

          <button
            onClick={onClear}
            className="w-full py-2.5 text-xs text-dark-400 hover:text-dark-200 transition-colors bg-dark-800/50 rounded-xl border border-dark-700"
          >
            Clear &amp; wait for next ride
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scroll Buttons ────────────────────────────────────────────────────────────
function ScrollButtons({ containerRef, color = "brand" }) {
  const [showTop,    setShowTop]    = useState(false);
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
      container.addEventListener("scroll", checkScroll);
      checkScroll();
      return () => container.removeEventListener("scroll", checkScroll);
    }
  }, []);

  const scrollToTop = () =>
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () =>
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });

  const bgColor =
    color === "brand"
      ? "bg-brand-500/80 hover:bg-brand-500"
      : "bg-blue-500/80 hover:bg-blue-500";

  return (
    <div className="absolute right-2 bottom-20 flex flex-col gap-2 z-10">
      {showTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className={`w-8 h-8 ${bgColor} rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all`}
          title="Scroll to top"
        >
          <ArrowUp size={14} className="text-white" />
        </motion.button>
      )}
      {showBottom && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToBottom}
          className={`w-8 h-8 ${bgColor} rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all`}
          title="Scroll to bottom"
        >
          <ArrowDown size={14} className="text-white" />
        </motion.button>
      )}
    </div>
  );
}

// ── Main Driver Panel ─────────────────────────────────────────────────────────
export default function DriverPanel() {
  const {
    ride,
    driverPosition,
    navStats,
    acceptRide,
    startRide,
    completeRide,
    rejectRide,
    clearRide,
    subscribeToPosition,
    getCurrentPosition,
    nearbyRides,
    getFormattedDistance,
    MAX_DRIVER_DISTANCE_KM,
  } = useRide();

  const [currentDriverPos,    setCurrentDriverPos]    = useState(null);
  const [showLocationDetails, setShowLocationDetails] = useState(true);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (subscribeToPosition) {
      const unsubscribe = subscribeToPosition((position) => {
        if (position) setCurrentDriverPos(position);
      });
      return () => unsubscribe();
    }
  }, [subscribeToPosition]);

  const isTerminal  = ride && TERMINAL_STATES.has(ride.status);
  const hasRide     = ride && !isTerminal;
  const isPending   = ride?.status === RIDE_STATUS.REQUESTING || ride?.status === RIDE_STATUS.PROCESSING;
  const isAccepted  = ride?.status === RIDE_STATUS.ACCEPTED;
  const isArrived   = ride?.status === RIDE_STATUS.ARRIVED;
  const isActive    = ride?.status === RIDE_STATUS.ACTIVE;
  const isComplete  = ride?.status === RIDE_STATUS.COMPLETED;

  const driverPos = currentDriverPos || driverPosition || getCurrentPosition?.();

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "—";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const hasNearbyRides = nearbyRides && nearbyRides.length > 0;

  return (
    <div className="relative w-full h-full">
      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="flex flex-col gap-4 overflow-y-auto h-full pr-2 custom-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-display font-bold text-lg leading-none">Driver</h2>
            <p className="text-dark-400 text-xs mt-0.5">
              Accept rides within {MAX_DRIVER_DISTANCE_KM}km radius
            </p>
          </div>
          <div className="ml-auto">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                hasRide ? "bg-green-500/20 text-green-400" : "bg-dark-700 text-dark-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasRide ? "bg-green-400 animate-ping-slow" : "bg-dark-500"
                }`}
              />
              {hasRide ? "On Duty" : "Idle"}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="w-full pb-4">

          {/* ── Idle / no ride ────────────────────────────────────────── */}
          {!ride && (
            <div className="flex flex-col gap-4 w-full">
              <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 text-center">
                <Target size={24} className="text-brand-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-lg">
                  {hasNearbyRides ? nearbyRides.length : 0}
                </p>
                <p className="text-dark-400 text-xs">
                  {hasNearbyRides
                    ? `ride(s) available within ${MAX_DRIVER_DISTANCE_KM}km`
                    : `No rides within ${MAX_DRIVER_DISTANCE_KM}km`}
                </p>
              </div>

              {hasNearbyRides && (
                <div className="space-y-2">
                  <p className="text-dark-400 text-[10px] uppercase tracking-wider px-1">
                    Nearby Requests
                  </p>
                  {nearbyRides.map((nearbyRide, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="rounded-xl p-3 border bg-dark-800/50 border-dark-700"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={12} className="text-brand-400" />
                        <span className="text-white text-xs truncate">
                          {getLocationNameFromCoords(nearbyRide.pickup.lat, nearbyRide.pickup.lng)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Navigation size={12} className="text-green-400" />
                          <span className="text-dark-300 text-xs truncate">
                            {getLocationNameFromCoords(nearbyRide.dropoff.lat, nearbyRide.dropoff.lng)}
                          </span>
                        </div>
                        <span className="text-brand-400 font-semibold text-sm">
                          NPR {nearbyRide.fare}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]">
                        <div className="bg-dark-700/50 rounded-lg p-2 text-center">
                          <span className="text-dark-400">Distance</span>
                          <p className="text-white font-semibold">{nearbyRide.distance}km</p>
                        </div>
                        <div className="bg-dark-700/50 rounded-lg p-2 text-center">
                          <span className="text-dark-400">ETA pickup</span>
                          <p className="text-white font-semibold">
                            {nearbyRide.distanceFormatted || getFormattedDistance(nearbyRide.distanceToPickup)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={acceptRide}
                        className="w-full py-2 rounded-lg text-white text-xs font-semibold shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/20 hover:shadow-green-500/30 hover:scale-105 transition-all"
                      >
                        <CheckCircle size={12} />
                        Accept Ride
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              {!hasNearbyRides && (
                <div className="flex flex-col items-center justify-center gap-4 py-8 w-full">
                  <div className="w-16 h-16 bg-dark-800 rounded-2xl flex items-center justify-center">
                    <Truck className="w-8 h-8 text-dark-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-dark-300 font-medium">Waiting for requests</p>
                    <p className="text-dark-500 text-xs mt-1">
                      New rides will appear here automatically
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-dark-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-dark-600 animate-pulse" />
                    Listening for nearby requests...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Completed — draggable payment modal ─────────────────── */}
          {isComplete && (
            <DraggablePaymentModal ride={ride} onClear={clearRide} />
          )}

          {/* ── Other terminal states ─────────────────────────────────── */}
          {isTerminal && !isComplete && (
            <div className="space-y-3 w-full">
              <div
                className={`rounded-xl p-4 border text-sm ${
                  ride.status === RIDE_STATUS.REJECTED
                    ? "bg-red-500/10 border-red-500/20 text-red-300"
                    : ride.status === RIDE_STATUS.CANCELLED
                    ? "bg-dark-700/50 border-dark-600 text-dark-300"
                    : "bg-red-500/10 border-red-500/20 text-red-300"
                }`}
              >
                {ride.status === RIDE_STATUS.REJECTED  && "You declined the ride request."}
                {ride.status === RIDE_STATUS.CANCELLED && "Rider cancelled the booking."}
                {ride.status === RIDE_STATUS.NO_DRIVER && "No response timeout."}
              </div>
              <button
                onClick={clearRide}
                className="w-full py-2.5 text-xs text-dark-400 hover:text-dark-200 bg-dark-800/50 rounded-xl border border-dark-700 transition-colors"
              >
                Clear &amp; wait for next ride
              </button>
            </div>
          )}

          {/* ── Incoming request ─────────────────────────────────────── */}
          {isPending && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-3 w-full"
            >
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-2 text-xs text-yellow-300">
                <AlertCircle size={14} className="animate-pulse flex-shrink-0" />
                New ride request incoming!
              </div>

              <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-3 w-full">
                <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Trip Details
                </p>
                <div className="space-y-2">
                  {[
                    { icon: MapPin,     color: "text-brand-400", bg: "bg-brand-500/20", label: "Pickup",  lat: ride.pickup.lat,  lng: ride.pickup.lng  },
                    { icon: Navigation, color: "text-green-400", bg: "bg-green-500/20", label: "Dropoff", lat: ride.dropoff.lat, lng: ride.dropoff.lng },
                  ].map(({ icon: Icon, color, bg, label, lat, lng }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className={`w-6 h-6 ${bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon size={12} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-dark-400">{label}</p>
                        <p className="text-sm text-white font-medium break-all">
                          {getLocationNameFromCoords(lat, lng)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dark-700 pt-3 grid grid-cols-2 gap-2">
                  <div className="bg-dark-700/50 rounded-lg p-2 text-center">
                    <p className="text-dark-400 text-xs">Distance</p>
                    <p className="text-white font-semibold text-sm">{ride.distance} km</p>
                  </div>
                  <div className="bg-brand-500/10 rounded-lg p-2 text-center">
                    <p className="text-brand-400 text-xs">Fare</p>
                    <p className="text-brand-300 font-semibold text-sm">NPR {ride.fare}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={rejectRide}
                  className="py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  Decline
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={acceptRide}
                  className="py-3 rounded-xl text-white text-sm font-semibold shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/20 hover:scale-105 transition-all"
                >
                  <CheckCircle size={14} />
                  Accept
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── En route to pickup ───────────────────────────────────── */}
          {isAccepted && (
            <div className="space-y-3 w-full">
              <ProgressSteps status={RIDE_STATUS.ACCEPTED} />

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center text-xl">
                    🚗
                  </div>
                  <div>
                    <p className="text-blue-300 font-semibold text-sm">Heading to pickup</p>
                    <p className="text-dark-400 text-xs">Follow the blue route on the map</p>
                  </div>
                </div>
                <NavStrip navStats={navStats} />
              </div>

              <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-3 space-y-1.5">
                <InfoRow label="Rider"    value={ride.riderName || "Rider"} />
                <InfoRow label="Fare"     value={`NPR ${ride.fare}`}        accent />
                <InfoRow label="Distance" value={`${ride.distance} km`} />
              </div>

              {showLocationDetails && driverPos && (
                <div className="bg-dark-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-dark-300 text-xs font-medium">Your Location (Live)</span>
                    </div>
                    <button onClick={() => setShowLocationDetails(false)} className="text-dark-500">
                      <Eye size={12} />
                    </button>
                  </div>
                  <p className="text-white text-xs font-mono break-all">
                    {getLocationNameFromCoords(driverPos.lat, driverPos.lng)}
                  </p>
                </div>
              )}

              {navStats && navStats.remainingM > 0 && (
                <div className="bg-dark-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-400 text-xs">Distance remaining:</span>
                    <span className="text-brand-400 font-bold">
                      {(navStats.remainingM / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-400 text-xs">ETA:</span>
                    <span className="text-brand-400 font-bold">{formatTime(navStats.remainingS)}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${navStats.progressT * 100}%` }}
                    />
                  </div>
                  <p className="text-dark-500 text-[10px] text-center mt-2">
                    {navStats.phase === "to_pickup" ? "Heading to pickup point" : "Heading to destination"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Arrived at pickup ────────────────────────────────────── */}
          {isArrived && (
            <div className="space-y-3 w-full">
              <ProgressSteps status={RIDE_STATUS.ARRIVED} />

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">📍</div>
                <p className="text-purple-300 font-bold text-sm">Arrived at pickup!</p>
                <p className="text-dark-400 text-xs mt-1">Waiting for rider to board…</p>
              </div>

              <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-3 space-y-2">
                <InfoRow label="Rider"    value={ride.riderName || "Rider"} />
                <InfoRow label="Fare"     value={`NPR ${ride.fare}`}        accent />
                <InfoRow label="Distance" value={`${ride.distance} km`} />
                <InfoRow label="Vehicle"  value={`${ride.vehicleType} · ${ride.plate}`} />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={startRide}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-orange-600 text-white font-bold text-sm shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
              >
                <Play size={15} />
                Start Ride
              </motion.button>
            </div>
          )}

          {/* ── Active ride ──────────────────────────────────────────── */}
          {isActive && (
            <div className="space-y-3 w-full">
              <ProgressSteps status={RIDE_STATUS.ACTIVE} />

              <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-2xl animate-bounce">🚕</div>
                  <div>
                    <p className="text-brand-300 font-bold text-sm">Ride in progress</p>
                    <p className="text-dark-400 text-xs">Navigating to dropoff via real roads</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-dark-500 text-[10px]">Elapsed</p>
                    <p className="text-white font-mono font-bold text-sm">
                      <RideTimer startTime={ride.startTime} />
                    </p>
                  </div>
                </div>
                <NavStrip navStats={navStats} />
              </div>

              <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-3 space-y-1.5">
                <InfoRow label="Fare"     value={`NPR ${ride.fare}`} accent large />
                <InfoRow label="Distance" value={`${ride.distance} km`} />
                <InfoRow label="Rider"    value={ride.riderName || "Rider"} />
              </div>

              {showLocationDetails && driverPos && (
                <div className="bg-dark-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-dark-300 text-xs font-medium">Your Location (Live)</span>
                    </div>
                    <button onClick={() => setShowLocationDetails(false)} className="text-dark-500">
                      <Eye size={12} />
                    </button>
                  </div>
                  <p className="text-white text-xs font-mono break-all">
                    {getLocationNameFromCoords(driverPos.lat, driverPos.lng)}
                  </p>
                </div>
              )}

              {navStats && navStats.remainingM > 0 && (
                <div className="bg-dark-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-400 text-xs">Distance remaining:</span>
                    <span className="text-brand-400 font-bold">
                      {(navStats.remainingM / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-400 text-xs">ETA:</span>
                    <span className="text-brand-400 font-bold">{formatTime(navStats.remainingS)}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${navStats.progressT * 100}%` }}
                    />
                  </div>
                  <p className="text-dark-500 text-[10px] text-center mt-2">
                    {Math.round(navStats.progressT * 100)}% Complete
                  </p>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={completeRide}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
              >
                <CheckCircle size={15} />
                Complete Ride
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <ScrollButtons containerRef={scrollContainerRef} color="blue" />
    </div>
  );
}