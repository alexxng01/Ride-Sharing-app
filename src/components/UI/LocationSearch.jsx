// src/components/UI/LocationSearch.jsx
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, X, Compass, Crosshair } from "lucide-react";

/**
 * Kathmandu Valley locations with precise coordinates.
 * Focuses on key areas within KTM valley (27.66-27.74 lat, 85.28-85.38 lng)
 */
const KTM_LOCATIONS_WITH_COORDS = [
  // Central Kathmandu
  { id: "thamel", name: "Thamel", lat: 27.7188, lng: 85.3299 },
  { id: "durbar-square", name: "Durbar Square", lat: 27.7074, lng: 85.3272 },
  { id: "new-road-gate", name: "New Road Gate", lat: 27.7154, lng: 85.3227 },
  { id: "ratna-park", name: "Ratna Park", lat: 27.7165, lng: 85.3189 },
  { id: "chabahil", name: "Chabahil", lat: 27.7245, lng: 85.3419 },
  { id: "kupondol", name: "Kupondol", lat: 27.7026, lng: 85.3341 },
  
  // Patan
  { id: "patan-durbar-square", name: "Patan Durbar Square", lat: 27.6752, lng: 85.3232 },
  { id: "mangal-bazar", name: "Mangal Bazar", lat: 27.6748, lng: 85.3254 },
  { id: "pim-bahal", name: "Pim Bahal", lat: 27.6793, lng: 85.3337 },
  
  // Bhaktapur
  { id: "bhaktapur-durbar-square", name: "Bhaktapur Durbar Square", lat: 27.6716, lng: 85.3883 },
  { id: "tachupal-tol", name: "Tachupal Tol", lat: 27.6733, lng: 85.3883 },
  
  // Sacred Sites
  { id: "boudhanath-stupa", name: "Boudhanath Stupa", lat: 27.7215, lng: 85.3648 },
  { id: "swayambhunath", name: "Swayambhunath", lat: 27.7214, lng: 85.2935 },
  { id: "pashupatinath", name: "Pashupatinath", lat: 27.7336, lng: 85.3361 },
  { id: "dakshinkali", name: "Dakshinkali", lat: 27.6537, lng: 85.2797 },
  
  // Transport
  { id: "airport-tia", name: "Airport (TIA)", lat: 27.7141, lng: 85.3593 },
  { id: "gongabu-bus-park", name: "Gongabu Bus Park", lat: 27.7532, lng: 85.3316 },
  { id: "sundhara-bus-park", name: "Sundhara Bus Park", lat: 27.7160, lng: 85.3180 },
  
  // Commercial/Residential
  { id: "baneshwor", name: "Baneshwor", lat: 27.7141, lng: 85.3467 },
  { id: "koteshwor", name: "Koteshwor", lat: 27.6975, lng: 85.3561 },
  { id: "bouddha", name: "Bouddha", lat: 27.7209, lng: 85.3641 },
  { id: "jawakhel", name: "Jawakhel", lat: 27.6833, lng: 85.3376 },
  { id: "jawalkhel", name: "Jawalkhel", lat: 27.6833, lng: 85.3377 }, // Changed slightly to make unique
  { id: "lalitpur", name: "Lalitpur", lat: 27.6844, lng: 85.3263 },
  { id: "baluwatar", name: "Baluwatar", lat: 27.7429, lng: 85.3269 },
  { id: "kalanki", name: "Kalanki", lat: 27.7181, lng: 85.2703 },
  { id: "narayan-gopal-chowk", name: "Narayan Gopal Chowk", lat: 27.7263, lng: 85.3274 },
  { id: "sinamangal", name: "Sinamangal", lat: 27.7107, lng: 85.3580 },
  { id: "putalisadak", name: "Putalisadak", lat: 27.7166, lng: 85.3234 },
  { id: "babarmahal", name: "Babarmahal", lat: 27.7218, lng: 85.3144 },
];

function LocationSearch({
  label,
  value,
  onChange,
  onMapClick = false,
  isMapClickActive = false,
  icon: Icon,
  color,
  placeholder,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mapClickMode, setMapClickMode] = useState(false);

  // Filter locations based on search input
  const filtered = KTM_LOCATIONS_WITH_COORDS.filter((loc) =>
    loc.name.toLowerCase().includes(search.toLowerCase())
  );

  // Handle location selection from list
  const handleSelectLocation = useCallback((loc) => {
    onChange({
      id: loc.id,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
    });
    setOpen(false);
    setSearch("");
    setMapClickMode(false);
  }, [onChange]);

  const displayValue = typeof value === "string" ? value : value?.name || "";

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>

      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between bg-dark-800 border ${
          value ? "border-dark-600" : "border-dark-700"
        } rounded-xl px-4 py-3 text-sm text-left transition-all hover:border-brand-500/50 focus:outline-none focus:border-brand-500 ${
          mapClickMode ? "ring-2 ring-brand-500/50" : ""
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon size={16} className={color} />
          <span className={`truncate ${displayValue ? "text-white" : "text-dark-500"}`}>
            {displayValue || (placeholder || `Choose ${label.toLowerCase()}`)}
          </span>
        </div>
        {mapClickMode && (
          <span className="text-xs text-brand-400 font-semibold ml-2 flex-shrink-0">
            Tap map
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 w-full bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-dark-700 space-y-2">
              <div className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2">
                <Search size={14} className="text-dark-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search location…"
                  className="bg-transparent text-sm text-white placeholder-dark-500 outline-none flex-1"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-dark-500 hover:text-dark-300 transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {onMapClick && (
                <button
                  onClick={() => {
                    setMapClickMode(!mapClickMode);
                    setSearch("");
                    if (!mapClickMode) setOpen(false);
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    mapClickMode
                      ? "bg-brand-500/20 border-brand-400/50 text-brand-300"
                      : "bg-dark-700 border-dark-600 text-dark-400 hover:bg-dark-600"
                  }`}
                >
                  <Crosshair size={12} />
                  {mapClickMode ? "Tap on map to select" : "Select on map"}
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-dark-500">
                  No locations found. Try another search.
                </div>
              ) : (
                filtered.map((loc) => (
                  <button
                    key={loc.id} // Using unique ID instead of lat-lng
                    onClick={() => handleSelectLocation(loc)}
                    className="w-full text-left px-4 py-2.5 text-sm text-dark-200 hover:bg-dark-700 hover:text-white transition-colors flex items-center gap-3 group"
                  >
                    <MapPin size={14} className="text-dark-500 group-hover:text-brand-400 transition" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{loc.name}</div>
                      <div className="text-xs text-dark-500 group-hover:text-dark-400">
                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {mapClickMode && !open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-1 left-0 right-0 bg-brand-500/20 border border-brand-500/40 rounded-lg px-3 py-2 text-xs text-brand-300 flex items-center gap-2"
        >
          <Compass size={12} className="animate-spin" />
          Click on the map to select {label.toLowerCase()}
        </motion.div>
      )}
    </div>
  );
}

export default LocationSearch;