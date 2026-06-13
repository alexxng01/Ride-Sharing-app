// src/components/Map/RideMap.jsx
import React, { useEffect, useRef, memo, useState, useCallback } from "react";
import {
  MapContainer, TileLayer, Marker, Polyline,
  Popup, useMap, Circle, useMapEvents
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { KTM_CENTER, calcDistance } from "../../lib/rideStates";
import { useRide } from "../../store/RideContext";
import { RIDE_STATUS } from "../../lib/rideStates";

// Fix default marker icons (CRA)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const FALLBACK_CENTER = [27.7172, 85.3240];

// ── Validators ────────────────────────────────────────────────────────────────
const isValidPos = (pos) => {
  if (!pos) return false;
  if (!Array.isArray(pos) || pos.length !== 2) return false;
  const [lat, lng] = pos;
  return (
    typeof lat === "number" && typeof lng === "number" &&
    isFinite(lat) && isFinite(lng) && !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
};

const toPos = (obj) => {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    const lat = parseFloat(obj[0]);
    const lng = parseFloat(obj[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    const pos = [lat, lng];
    return isValidPos(pos) ? pos : null;
  }
  const lat = parseFloat(obj.lat ?? obj.latitude);
  const lng = parseFloat(obj.lng ?? obj.longitude);
  if (isNaN(lat) || isNaN(lng)) return null;
  const pos = [lat, lng];
  return isValidPos(pos) ? pos : null;
};

const getSafeCenter = () => {
  if (Array.isArray(KTM_CENTER) && isValidPos(KTM_CENTER)) return KTM_CENTER;
  return toPos(KTM_CENTER) ?? FALLBACK_CENTER;
};

// ── Check if Leaflet map panes are fully initialized ─────────────────────────
const isMapPanesReady = (map) => {
  if (!map) return false;
  try {
    const container = map.getContainer();
    if (!container) return false;
    const mapPane = map.getPane("mapPane");
    if (!mapPane) return false;
    // The critical check: _leaflet_pos must exist on the map pane
    if (mapPane._leaflet_pos === undefined) return false;
    return true;
  } catch (e) {
    return false;
  }
};

// ── Safe setView wrapper ──────────────────────────────────────────────────────
const safeSetView = (map, center, zoom, options = {}) => {
  if (!map || !center || !isValidPos(center)) return;
  if (!isMapPanesReady(map)) return;
  try {
    map.setView(center, zoom, options);
  } catch (e) {
    console.warn("safeSetView suppressed:", e.message);
  }
};

// ── Format helpers ────────────────────────────────────────────────────────────
const fmtDist = (m) => {
  if (!m && m !== 0) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

const fmtTime = (s) => {
  if (!s && s !== 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const mins = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${mins}m ${secs}s`;
};

const calculateETAFromDistance = (distanceKm) => {
  const SPEED_KMH = 30;
  const timeHours = distanceKm / SPEED_KMH;
  const totalSeconds = Math.floor(timeHours * 3600);
  return {
    seconds: totalSeconds,
    minutes: Math.floor(totalSeconds / 60),
    display: fmtTime(totalSeconds)
  };
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const makeIcon = (color, emoji, size = 36) =>
  L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;background:${color};
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:${size * 0.44}px;line-height:1">${emoji}</span>
    </div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size],
    popupAnchor: [0, -size],
    className:   "",
  });

const riderIcon   = makeIcon("#f97316", "🧑");
const driverIcon  = makeIcon("#3b82f6", "🚗");
const dropoffIcon = makeIcon("#10b981", "🏁");

const driverActiveIcon = L.divIcon({
  html: `<div style="position:relative;width:44px;height:44px">
    <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.3;animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite"></div>
    <div style="position:absolute;inset:4px;background:#3b82f6;border-radius:50%;border:3px solid white;
      display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 12px rgba(59,130,246,0.6)">🚗</div>
    <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
  </div>`,
  iconSize:    [44, 44],
  iconAnchor:  [22, 22],
  popupAnchor: [0, -22],
  className:   "",
});

// ── MapClickHandler ───────────────────────────────────────────────────────────
const MapClickHandler = memo(function MapClickHandler({ onLocationSelect, selectionMode }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      if (isValidPos([lat, lng])) {
        if (selectionMode && window.handleRiderMapSelection) {
          window.handleRiderMapSelection({ lat, lng }, selectionMode);
        } else if (onLocationSelect) {
          onLocationSelect({ lat, lng });
        }
      }
    },
  });
  return null;
});

// ── SafeMapController — guards every setView call ────────────────────────────
function SafeMapController({ center, zoom = 14, shouldCenter }) {
  const map = useMap();
  const lastCenterRef = useRef(null);
  const retryRef = useRef(null);

  const trySetView = useCallback(() => {
    if (!shouldCenter || !center || !isValidPos(center)) return;

    // Skip if already at this center
    const prev = lastCenterRef.current;
    if (prev && prev[0] === center[0] && prev[1] === center[1]) return;

    if (!isMapPanesReady(map)) {
      // Retry in 150 ms if panes aren't ready yet
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(trySetView, 150);
      return;
    }

    safeSetView(map, center, zoom, { animate: false });
    lastCenterRef.current = center;
  }, [map, center, zoom, shouldCenter]);

  useEffect(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    trySetView();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [trySetView]);

  return null;
}

// ── ETA Display Overlay ───────────────────────────────────────────────────────
function ETADisplayOverlay({ etaSeconds, distanceKm, phase, isLive }) {
  const [timeLeft, setTimeLeft] = useState(etaSeconds);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLive || !etaSeconds || etaSeconds <= 0) return;
    const startTime = Date.now();
    const initialRemaining = etaSeconds;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, initialRemaining - elapsed);
      setTimeLeft(remaining);
      setProgress(Math.min(100, ((initialRemaining - remaining) / initialRemaining) * 100));
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [etaSeconds, isLive]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  const phaseIcon = phase === "to_pickup" ? "🚗" : phase === "to_dropoff" ? "🏁" : "📍";
  const phaseText = phase === "to_pickup" ? "TO PICKUP" : phase === "to_dropoff" ? "TO DROPOFF" : "DESTINATION";

  return (
    <div className="absolute bottom-20 left-3 right-3 z-[999] pointer-events-none">
      <div className="bg-dark-900/95 backdrop-blur-md border border-brand-500/30 rounded-2xl px-4 py-3 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{phaseIcon}</span>
            <span className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold">{phaseText}</span>
          </div>
          {isLive && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-[10px] font-medium">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="text-white font-bold text-3xl leading-tight">
              {minutes > 0 ? `${minutes}m ` : ''}{seconds > 0 ? `${seconds}s` : minutes > 0 ? '00s' : 'Arriving'}
            </span>
            {distanceKm && <span className="text-dark-400 text-xs mt-1">{distanceKm} to go</span>}
          </div>
          <div className="text-right">
            <span className="text-dark-500 text-[10px]">Est. arrival</span>
            <p className="text-white text-sm font-medium">
              {new Date(Date.now() + (timeLeft * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: phase === "to_pickup"
                ? "linear-gradient(90deg,#3b82f6,#60a5fa)"
                : "linear-gradient(90deg,#f97316,#fb923c)"
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-dark-500">
          <span>{Math.round(progress)}% Complete</span>
          <span>ETA: {fmtTime(timeLeft)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function RideMap({ onLocationSelect, selectionMode }) {
  const { ride, driverPosition, routeData, navStats, subscribeToPosition, getCurrentPosition } = useRide();
  const [mapMode, setMapMode] = useState("satellite");
  const [showTraffic, setShowTraffic] = useState(false);
  const [currentDriverPos, setCurrentDriverPos] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const unsubscribeRef = useRef(null);

  // Subscribe to real-time driver position
  useEffect(() => {
    if (!subscribeToPosition) return;
    unsubscribeRef.current = subscribeToPosition((position) => {
      if (position && !isNaN(position.lat) && !isNaN(position.lng)) {
        setCurrentDriverPos([position.lat, position.lng]);
      }
    });
    return () => { unsubscribeRef.current?.(); };
  }, [subscribeToPosition]);

  const validPickup  = toPos(ride?.pickup);
  const validDropoff = toPos(ride?.dropoff);
  const validDriver  = toPos(currentDriverPos) ?? toPos(driverPosition) ?? toPos(getCurrentPosition?.());

  const status = ride?.status;

  // Initial center — prefer pickup, then driver, then KTM
  const initialCenter = (() => {
    if (validPickup  && isValidPos(validPickup))  return validPickup;
    if (validDriver  && isValidPos(validDriver))  return validDriver;
    if (validDropoff && isValidPos(validDropoff)) return validDropoff;
    return getSafeCenter();
  })();

  const shouldCenterOnDriver =
    (status === RIDE_STATUS.ACCEPTED || status === RIDE_STATUS.ACTIVE) &&
    validDriver && isValidPos(validDriver);

  // Real-time ETA
  const getRealTimeETA = useCallback(() => {
    if (!ride) return null;
    if (status === RIDE_STATUS.ACCEPTED && validDriver && ride.pickup) {
      return calculateETAFromDistance(calcDistance(validDriver, ride.pickup));
    }
    if (status === RIDE_STATUS.ACTIVE && validDriver && ride.dropoff) {
      return calculateETAFromDistance(calcDistance(validDriver, ride.dropoff));
    }
    return null;
  }, [status, validDriver, ride]);

  const toPickupPoints  = routeData?.toPickup?.waypoints?.map(w => toPos(w)).filter(Boolean) ?? [];
  const toDropoffPoints = routeData?.toDropoff?.waypoints?.map(w => toPos(w)).filter(Boolean) ?? [];

  const activeRoutePoints = status === RIDE_STATUS.ACCEPTED
    ? toPickupPoints
    : status === RIDE_STATUS.ACTIVE
      ? toDropoffPoints
      : [];
  const ghostRoutePoints = status === RIDE_STATUS.ACCEPTED ? toDropoffPoints : [];

  const realTimeETA = getRealTimeETA();
  const isAccepted  = status === RIDE_STATUS.ACCEPTED;
  const isActiveRide = status === RIDE_STATUS.ACTIVE;
  const isArrived   = status === RIDE_STATUS.ARRIVED;
  const isLivePhase = isAccepted || isActiveRide;

  let etaPhase    = null;
  let etaDistance = null;
  if (isAccepted && validDriver && ride?.pickup) {
    etaPhase    = "to_pickup";
    etaDistance = `${calcDistance(validDriver, ride.pickup).toFixed(1)} km`;
  } else if (isActiveRide && validDriver && ride?.dropoff) {
    etaPhase    = "to_dropoff";
    etaDistance = `${calcDistance(validDriver, ride.dropoff).toFixed(1)} km`;
  }

  const driverName  = ride?.driverName || "Driver";
  const vehicleInfo = ride?.vehicleType ? `${ride.vehicleType} · ${ride.plate || ""}` : "";

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
      <MapContainer
        key="ride-map"
        center={initialCenter}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        style={{ background: "#0f172a" }}
        whenReady={() => setMapReady(true)}
      >
        {/* Tile layers */}
        {mapMode === "dark" && (
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" maxZoom={19} />
        )}
        {mapMode === "street" && (
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" maxZoom={19} />
        )}
        {mapMode === "satellite" && (
          <>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" maxZoom={19} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" opacity={0.15} attribution="Labels" maxZoom={19} />
          </>
        )}
        {mapMode === "terrain" && (
          <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="&copy; OpenTopoMap" maxZoom={17} />
        )}
        {showTraffic && (
          <TileLayer url="https://tile.openweathermap.org/map/traffic_new/{z}/{x}/{y}.png?appid=b6fd3a6cd2efc34f0cdc599788735e7d" opacity={0.4} maxZoom={19} />
        )}

        {/* Handlers — only mount after map is ready */}
        <MapClickHandler onLocationSelect={onLocationSelect} selectionMode={selectionMode} />
        {mapReady && (
          <SafeMapController
            center={shouldCenterOnDriver ? validDriver : null}
            zoom={14}
            shouldCenter={!!shouldCenterOnDriver}
          />
        )}

        {/* Ghost route (upcoming leg) */}
        {ghostRoutePoints.length > 1 && (
          <Polyline positions={ghostRoutePoints} pathOptions={{ color: "#475569", weight: 3, opacity: 0.35, dashArray: "6 5" }} />
        )}

        {/* Active route — shadow + colour */}
        {activeRoutePoints.length > 1 && (
          <>
            <Polyline positions={activeRoutePoints} pathOptions={{ color: "#1e40af", weight: 8, opacity: 0.3 }} />
            <Polyline positions={activeRoutePoints} pathOptions={{ color: isActiveRide ? "#f97316" : "#60a5fa", weight: 4, opacity: 0.95 }} />
          </>
        )}

        {/* Progress overlay */}
        {activeRoutePoints.length > 1 && navStats && navStats.progressT > 0 && (
          <Polyline
            positions={activeRoutePoints.slice(0, Math.max(1, Math.floor(navStats.progressT * activeRoutePoints.length)))}
            pathOptions={{ color: isActiveRide ? "#fbbf24" : "#93c5fd", weight: 6, opacity: 0.8 }}
          />
        )}

        {/* Pickup marker */}
        {validPickup && isValidPos(validPickup) && (
          <Marker position={validPickup} icon={riderIcon}>
            <Popup>
              <div className="font-semibold text-xs">📍 Pickup Location</div>
              <div className="text-xs text-gray-500">{validPickup[0].toFixed(5)}, {validPickup[1].toFixed(5)}</div>
              {isArrived && <div className="text-xs text-green-500 mt-1">✓ Driver has arrived</div>}
            </Popup>
          </Marker>
        )}

        {/* Dropoff marker + zone */}
        {validDropoff && isValidPos(validDropoff) && (
          <>
            <Circle center={validDropoff} radius={80} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.12, weight: 1.5 }} />
            <Marker position={validDropoff} icon={dropoffIcon}>
              <Popup>
                <div className="font-semibold text-xs">🏁 Dropoff Location</div>
                <div className="text-xs text-gray-500">{validDropoff[0].toFixed(5)}, {validDropoff[1].toFixed(5)}</div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Driver marker */}
        {validDriver && isValidPos(validDriver) && (isAccepted || isArrived || isActiveRide) && (
          <Marker position={validDriver} icon={isActiveRide ? driverActiveIcon : driverIcon}>
            <Popup>
              <div className="text-center">
                <div className="font-semibold text-xs text-blue-400">🚗 {driverName} (Live)</div>
                {vehicleInfo && <div className="text-xs text-gray-400">{vehicleInfo}</div>}
                <div className="text-xs text-gray-500 mt-1">{validDriver[0].toFixed(5)}, {validDriver[1].toFixed(5)}</div>
                {realTimeETA && realTimeETA.seconds > 0 && (
                  <div className="text-xs text-orange-400 mt-1">ETA: {realTimeETA.display}</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Top status bar */}
      {ride?.status && (
        <div className="absolute top-3 left-3 right-3 z-[999] flex items-start justify-between gap-2 pointer-events-none">
          <div className="bg-dark-900/90 backdrop-blur-md border border-dark-700/60 rounded-xl px-3 py-2 text-xs text-dark-300">
            <span className="text-brand-400 font-semibold">KTM Valley</span>
            {"  ·  "}{ride.distance} km{"  ·  "}
            <span className="text-white font-medium">NPR {ride.fare}</span>
          </div>
          <div className={`backdrop-blur-md border rounded-xl px-3 py-2 text-xs font-semibold ${
            isArrived    ? "bg-purple-500/90 border-purple-400/40 text-white animate-pulse" :
            isActiveRide ? "bg-green-500/90  border-green-400/40  text-white" :
            isAccepted   ? "bg-blue-500/90   border-blue-400/40   text-white" :
                           "bg-dark-900/90   border-dark-700/60   text-dark-300"
          }`}>
            {isArrived    ? "📍 Driver Arrived!" :
             isActiveRide ? "🚗 Ride in Progress" :
             isAccepted   ? "🚗 Driver En Route" :
             status === RIDE_STATUS.REQUESTING  ? "⏳ Finding Driver..." :
             status === RIDE_STATUS.PROCESSING  ? "🔄 Processing..." :
             status === RIDE_STATUS.COMPLETED   ? "✅ Ride Completed" :
             status === RIDE_STATUS.CANCELLED   ? "❌ Cancelled" : status}
          </div>
        </div>
      )}

      {/* Selection mode hint */}
      {selectionMode && (
        <div className="absolute top-20 left-3 right-3 z-[999] pointer-events-none">
          <div className="bg-brand-500/90 backdrop-blur-md border border-brand-400/40 rounded-xl px-3 py-2 text-xs text-white font-semibold text-center">
            📍 Click on map to select {selectionMode === "pickup" ? "PICKUP" : "DROPOFF"} location
          </div>
        </div>
      )}

      {/* Live ETA overlay */}
      {isLivePhase && realTimeETA && realTimeETA.seconds > 0 && (
        <ETADisplayOverlay
          etaSeconds={realTimeETA.seconds}
          distanceKm={etaDistance}
          phase={etaPhase}
          isLive={true}
        />
      )}

      {/* Map style controls */}
      <div className="absolute top-3 right-3 z-[999] flex flex-col gap-1.5 pointer-events-auto">
        <div className="bg-dark-800/80 backdrop-blur-md border border-dark-600 rounded-lg px-2 py-1 text-[10px] text-green-400 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live Tracking
        </div>
        <div className="flex flex-col gap-1 bg-dark-800/80 backdrop-blur-md border border-dark-600 rounded-xl overflow-hidden">
          {[
            { mode: "street",    emoji: "☀️", label: "Street"    },
            { mode: "dark",      emoji: "🌙", label: "Dark"      },
            { mode: "satellite", emoji: "🛰️", label: "Satellite" },
            { mode: "terrain",   emoji: "🏔️", label: "Terrain"   },
          ].map(({ mode, emoji, label }) => (
            <button key={mode} onClick={() => setMapMode(mode)}
              className={`px-3 py-2 text-xs font-medium transition-all ${
                mapMode === mode
                  ? "bg-brand-500/30 text-brand-300"
                  : "bg-transparent text-dark-400 hover:text-white hover:bg-dark-700/50"
              }`} title={label}>{emoji}
            </button>
          ))}
        </div>
        <button onClick={() => setShowTraffic(!showTraffic)}
          className={`flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium transition-all backdrop-blur-md border ${
            showTraffic
              ? "bg-red-500/20 border-red-400/50 text-red-300 hover:bg-red-500/30"
              : "bg-dark-800/80 border-dark-600 text-dark-300 hover:bg-dark-700"
          }`}>
          {showTraffic ? "🚗 Traffic ON" : "🚦 Traffic"}
        </button>
      </div>

      {/* Driver live badge */}
      {validDriver && (isAccepted || isActiveRide) && (
        <div className="absolute bottom-3 right-3 z-[999] pointer-events-none">
          <div className="bg-dark-900/80 backdrop-blur-md rounded-lg px-2 py-1 text-[10px] text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />Driver Live Location
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RideMap);