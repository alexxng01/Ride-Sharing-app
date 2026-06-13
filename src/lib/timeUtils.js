// src/lib/timeUtils.js
export const calculateTimeFromDistance = (distanceKm, speedKmh = 30) => {
  const timeHours = distanceKm / speedKmh;
  const timeMinutes = timeHours * 60;
  return {
    minutes: Math.floor(timeMinutes),
    seconds: Math.floor((timeMinutes % 1) * 60),
    totalSeconds: Math.floor(timeMinutes * 60)
  };
};

export const formatDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export const getProgressPercentage = (startTime, totalDuration) => {
  if (!startTime) return 0;
  const elapsed = (Date.now() - startTime) / 1000;
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
};

export const isRideComplete = (startTime, totalDuration) => {
  if (!startTime) return false;
  const elapsed = (Date.now() - startTime) / 1000;
  return elapsed >= totalDuration;
};