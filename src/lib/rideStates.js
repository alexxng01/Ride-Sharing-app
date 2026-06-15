// src/lib/rideStates.js

export const RIDE_STATUS = {
  IDLE:        "idle",
  REQUESTING:  "requesting",
  PROCESSING:  "processing",
  ACCEPTED:    "accepted",     // Driver en-route to pickup
  ARRIVED:     "arrived",      // Driver at pickup
  ACTIVE:      "active",       // Ride in progress → dropoff
  COMPLETED:   "completed",    // Terminal: success
  CANCELLED:   "cancelled",    // Terminal: rider cancelled
  REJECTED:    "rejected",     // Terminal: driver rejected
  NO_DRIVER:   "no_driver",    // Terminal: timeout
};

export const TERMINAL_STATES = new Set([
  RIDE_STATUS.COMPLETED,
  RIDE_STATUS.CANCELLED,
  RIDE_STATUS.REJECTED,
  RIDE_STATUS.NO_DRIVER,
]);

export const RIDE_STATUS_LABELS = {
  [RIDE_STATUS.IDLE]:       "Ready",
  [RIDE_STATUS.REQUESTING]: "Finding a driver…",
  [RIDE_STATUS.PROCESSING]: "Driver is deciding…",
  [RIDE_STATUS.ACCEPTED]:   "Driver on the way",
  [RIDE_STATUS.ARRIVED]:    "Driver arrived",
  [RIDE_STATUS.ACTIVE]:     "Ride in progress",
  [RIDE_STATUS.COMPLETED]:  "Ride completed",
  [RIDE_STATUS.CANCELLED]:  "Ride cancelled",
  [RIDE_STATUS.REJECTED]:   "Driver declined",
  [RIDE_STATUS.NO_DRIVER]:  "No drivers available",
};

export const RIDE_STATUS_COLORS = {
  [RIDE_STATUS.IDLE]:       "text-dark-400",
  [RIDE_STATUS.REQUESTING]: "text-yellow-400",
  [RIDE_STATUS.PROCESSING]: "text-orange-400",
  [RIDE_STATUS.ACCEPTED]:   "text-blue-400",
  [RIDE_STATUS.ARRIVED]:    "text-purple-400",
  [RIDE_STATUS.ACTIVE]:     "text-brand-400",
  [RIDE_STATUS.COMPLETED]:  "text-green-400",
  [RIDE_STATUS.CANCELLED]:  "text-dark-400",
  [RIDE_STATUS.REJECTED]:   "text-red-400",
  [RIDE_STATUS.NO_DRIVER]:  "text-red-400",
};

export const KTM_BOUNDS = {
  lat: { min: 27.66, max: 27.74 },
  lng: { min: 85.28, max: 85.38 },
};

export const KTM_CENTER = [27.7172, 85.3240];

// Speed constants (in km/h)
export const SPEEDS = {
  CITY_TRAFFIC: 30,      // km/h - Average speed in city traffic
  HIGHWAY: 60,           // km/h - Highway speed
  PEAK_TRAFFIC: 20,      // km/h - Peak hour traffic
  NIGHT: 40,             // km/h - Night time speed
};

// Time calculation functions
export const calculateETA = (distanceKm, speedKmh = SPEEDS.CITY_TRAFFIC) => {
  const timeHours = distanceKm / speedKmh;
  const timeMinutes = timeHours * 60;
  return {
    minutes: Math.floor(timeMinutes),
    seconds: Math.floor((timeMinutes % 1) * 60),
    totalSeconds: Math.floor(timeMinutes * 60),
    distanceKm: distanceKm,
    speedKmh: speedKmh
  };
};

export const calculateETAFromMeters = (distanceMeters, speedKmh = SPEEDS.CITY_TRAFFIC) => {
  const distanceKm = distanceMeters / 1000;
  return calculateETA(distanceKm, speedKmh);
};

export const formatTimeDisplay = (totalSeconds) => {
  if (totalSeconds < 60) {
    return `${Math.floor(totalSeconds)} sec`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (seconds === 0) {
    return `${minutes} min`;
  }
  return `${minutes} min ${seconds} sec`;
};

export const formatTimeShort = (totalSeconds) => {
  if (totalSeconds < 60) {
    return `${Math.floor(totalSeconds)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

export const getEstimatedDuration = (distanceKm) => {
  const eta = calculateETA(distanceKm, SPEEDS.CITY_TRAFFIC);
  return eta.totalSeconds;
};

export const getPickupETA = (driverDistanceKm) => {
  return calculateETA(driverDistanceKm, SPEEDS.CITY_TRAFFIC);
};

export const getDropoffETA = (tripDistanceKm) => {
  return calculateETA(tripDistanceKm, SPEEDS.CITY_TRAFFIC);
};

export const shouldCompleteRide = (startTime, durationSeconds) => {
  if (!startTime) return false;
  const elapsed = (Date.now() - startTime) / 1000;
  return elapsed >= durationSeconds;
};

export const getRemainingTime = (startTime, durationSeconds) => {
  if (!startTime) return durationSeconds;
  const elapsed = (Date.now() - startTime) / 1000;
  return Math.max(0, durationSeconds - elapsed);
};

export const getProgressPercentage = (startTime, durationSeconds) => {
  if (!startTime) return 0;
  const elapsed = (Date.now() - startTime) / 1000;
  return Math.min(100, Math.max(0, (elapsed / durationSeconds) * 100));
};

// Dynamic speed based on time of day
export const getCurrentSpeed = () => {
  const hour = new Date().getHours();
  // Peak traffic hours: 8-10 AM and 5-7 PM
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
    return SPEEDS.PEAK_TRAFFIC;
  }
  // Night time: 10 PM - 6 AM
  if (hour >= 22 || hour <= 6) {
    return SPEEDS.NIGHT;
  }
  return SPEEDS.CITY_TRAFFIC;
};

// Calculate dynamic ETA based on current time
export const calculateDynamicETA = (distanceKm) => {
  const currentSpeed = getCurrentSpeed();
  return calculateETA(distanceKm, currentSpeed);
};

export function randomKtmCoord() {
  return {
    lat: KTM_BOUNDS.lat.min + Math.random() * (KTM_BOUNDS.lat.max - KTM_BOUNDS.lat.min),
    lng: KTM_BOUNDS.lng.min + Math.random() * (KTM_BOUNDS.lng.max - KTM_BOUNDS.lng.min),
  };
}

// Accept both {lat, lng} and {latitude, longitude} shapes; also bare arrays.
// Returns NaN if either point is missing or non-numeric (callers should
// defensively check, e.g. via Number.isFinite before rendering).
export function calcDistance(a, b) {
  const aLat = Number(a?.lat ?? a?.latitude ?? a?.[0]);
  const aLng = Number(a?.lng ?? a?.longitude ?? a?.[1]);
  const bLat = Number(b?.lat ?? b?.latitude ?? b?.[0]);
  const bLng = Number(b?.lng ?? b?.longitude ?? b?.[1]);
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return NaN;

  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function calcFare(distanceKm) {
  const base  = 50;
  const perKm = 25;
  return Math.round(base + distanceKm * perKm);
}

export function interpolate(start, end, t) {
  const sLat = Number(start?.lat ?? start?.latitude);
  const sLng = Number(start?.lng ?? start?.longitude);
  const eLat = Number(end?.lat ?? end?.latitude);
  const eLng = Number(end?.lng ?? end?.longitude);
  if (![sLat, sLng, eLat, eLng].every(Number.isFinite)) return null;
  return {
    lat: sLat + (eLat - sLat) * t,
    lng: sLng + (eLng - sLng) * t,
  };
}

/**
 * Fetch a real road route from OSRM (free, no API key).
 * Returns array of {lat, lng} waypoints along the actual road.
 */
export async function fetchOsrmRoute(from, to) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson&steps=false`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes?.length) return null;

    const coords = data.routes[0].geometry.coordinates; // [lng, lat]
    const distanceM = data.routes[0].distance;
    const durationS = data.routes[0].duration;
    
    return {
      waypoints: coords.map(([lng, lat]) => ({ lat, lng })),
      distanceM: distanceM,   // metres
      durationS: durationS,   // seconds from OSRM
      estimatedTimeMinutes: Math.ceil(durationS / 60),
      estimatedTimeDisplay: formatTimeDisplay(durationS),
    };
  } catch {
    return null;
  }
}

// Helper function to get time-based greeting
export const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

// Format distance for display
export const formatDistance = (km) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

// Calculate total trip time including waiting
export const getTotalTripTime = (driverDistanceKm, tripDistanceKm) => {
  const driverETA = calculateETA(driverDistanceKm, SPEEDS.CITY_TRAFFIC);
  const tripETA = calculateETA(tripDistanceKm, SPEEDS.CITY_TRAFFIC);
  return {
    driverArrival: driverETA,
    tripDuration: tripETA,
    totalTime: driverETA.totalSeconds + tripETA.totalSeconds,
  };
};

// Check if ride is within reasonable time
export const isReasonableRide = (distanceKm) => {
  const eta = calculateETA(distanceKm);
  return eta.totalSeconds <= 3600; // Max 1 hour ride
};

// Get traffic condition based on time
export const getTrafficCondition = () => {
  const hour = new Date().getHours();
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
    return "Heavy Traffic";
  }
  if (hour >= 22 || hour <= 6) {
    return "Light Traffic";
  }
  return "Moderate Traffic";
};

// Calculate fare with surge pricing based on time
export const calculateSurgeFare = (distanceKm) => {
  const baseFare = calcFare(distanceKm);
  const hour = new Date().getHours();
  let multiplier = 1;
  
  // Surge pricing during peak hours
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
    multiplier = 1.5;
  } else if (hour >= 22 || hour <= 6) {
    multiplier = 1.2;
  }
  
  return Math.round(baseFare * multiplier);
};

export const MAX_DRIVER_DISTANCE_KM = 1.0;