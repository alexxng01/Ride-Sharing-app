// src/components/Dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Navigation, Truck, Clock, LogOut, Activity,
  ChevronRight, Home, User, Star, Wallet, Menu, X,
  Bell, Search, Settings, HelpCircle, Award, Zap,
  Bike, Package, Coffee, ShoppingBag, Map, MapPin, Eye, EyeOff,
  ArrowUp, ArrowDown
} from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useAuth } from "../store/AuthContext";
import { useRide } from "../store/RideContext";
import { RIDE_STATUS } from "../lib/rideStates";
import RideMap from "./Map/RideMap";
import RiderPanel from "./Rider/RiderPanel";
import DriverPanel, { DraggablePaymentModal } from "./Driver/DriverPanel";
import HistoryPanel from "./History/HistoryPanel";

// ── Service Card Component ─────────────────────────────────────────────
function ServiceCard({ icon: Icon, title, subtitle, badge, color, onClick }) {
  const colorClasses = {
    brand: "from-brand-500 to-orange-600",
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    pink: "from-pink-500 to-pink-600",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative bg-dark-800/80 backdrop-blur-sm border border-dark-700 rounded-2xl p-4 text-left hover:border-brand-500/50 transition-all group w-full"
    >
      {badge && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
        <Icon size={22} className="text-white" />
      </div>
      <h3 className="text-white font-bold text-base">{title}</h3>
      <p className="text-dark-400 text-xs mt-0.5">{subtitle}</p>
      {badge === "LESS FARE" && (
        <span className="inline-block mt-2 text-[10px] font-semibold text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </motion.button>
  );
}

// ── Quick Action Button ────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
    >
      <div className="w-12 h-12 bg-dark-800 rounded-full flex items-center justify-center border border-dark-700 hover:border-brand-500/50 transition-all group">
        <Icon size={20} className="text-dark-400 group-hover:text-brand-400 transition-colors" />
      </div>
      <span className="text-[10px] text-dark-400">{label}</span>
    </motion.button>
  );
}

// ── Points Card ───────────────────────────────────────────────────────
function PointsCard() {
  return (
    <div className="bg-gradient-to-br from-brand-500/20 to-orange-600/20 border border-brand-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-brand-400" />
          <span className="text-white font-semibold text-sm">Bronze User</span>
        </div>
        <span className="text-brand-400 text-xs font-medium">Avail benefits</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-dark-400 text-[10px]">Points</p>
          <p className="text-white font-bold text-xl">801 <span className="text-xs text-dark-400">Points</span></p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="px-3 py-1.5 bg-brand-500/20 border border-brand-500/40 rounded-lg text-brand-400 text-xs font-medium"
        >
          Redeem now
        </motion.button>
      </div>
      <p className="text-dark-500 text-[10px] mt-2">9 deals available</p>
    </div>
  );
}

// ── Spotlight Card ────────────────────────────────────────────────────
function SpotlightCard({ title, subtitle, bgColor }) {
  return (
    <div className={`bg-gradient-to-r ${bgColor} rounded-2xl p-4 min-w-[200px]`}>
      <p className="text-white font-bold text-sm">{title}</p>
      <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>
    </div>
  );
}

// ── Switch Hint ───────────────────────────────────────────────────────
function SwitchHint({ role, onSwitch }) {
  const other = role === "rider" ? "driver" : "rider";
  const OtherIcon = role === "rider" ? Truck : Navigation;
  const color =
    role === "rider"
      ? "text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
      : "text-brand-400 border-brand-500/30 hover:bg-brand-500/10";

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSwitch}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium transition-all ${color}`}
    >
      <OtherIcon size={13} />
      Switch to {other.charAt(0).toUpperCase() + other.slice(1)} mode
    </motion.button>
  );
}

// ── Live Status Bar ───────────────────────────────────────────────────
function RideStatusBar({ ride }) {
  const isActive = [
    RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING,
    RIDE_STATUS.ACCEPTED,   RIDE_STATUS.ARRIVED, RIDE_STATUS.ACTIVE,
  ].includes(ride?.status);
  if (!isActive) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-2 flex items-center gap-3 text-xs flex-shrink-0"
    >
      <Activity size={12} className="text-brand-400 animate-pulse" />
      <span className="text-brand-300 font-medium">Live Ride Active</span>
      <span className="text-dark-400">·</span>
      <span className="text-dark-300">{ride.driverName || "Finding driver…"}</span>
      {ride.fare && (
        <>
          <span className="text-dark-400">·</span>
          <span className="text-brand-400 font-semibold">NPR {ride.fare}</span>
        </>
      )}
    </motion.div>
  );
}

// ── Scroll Buttons ────────────────────────────────────────────────────
function ScrollButtons({ containerRef, color = "brand" }) {
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
      container.addEventListener("scroll", checkScroll);
      checkScroll();
      return () => container.removeEventListener("scroll", checkScroll);
    }
  }, []);

  const scrollToTop = () => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () =>
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });

  const bgColor =
    color === "brand"
      ? "bg-brand-500/80 hover:bg-brand-500"
      : color === "blue"
      ? "bg-blue-500/80 hover:bg-blue-500"
      : "bg-purple-500/80 hover:bg-purple-500";

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

// ── Main Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const { ride, handleMapLocationClick, mapSelectionMode, setMapSelectionMode, clearRide } = useRide();
  const [activeTab, setActiveTab] = useState("home");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const homeScrollRef    = useRef(null);
  const riderScrollRef   = useRef(null);
  const driverScrollRef  = useRef(null);
  const historyScrollRef = useRef(null);

  const navigateToHome    = () => { setActiveTab("home");    setShowMobileMenu(false); };
  const navigateToRider   = () => { setActiveTab("rider");   setShowMobileMenu(false); };
  const navigateToDriver  = () => { setActiveTab("driver");  setShowMobileMenu(false); };
  const navigateToHistory = () => { setActiveTab("history"); setShowMobileMenu(false); };
  const navigateToMap     = () => { setActiveTab("map");     setShowMobileMenu(false); };
  const toggleMapVisibility = () => setShowMap((v) => !v);

  const services = [
    { icon: Bike,        title: "Bike",    subtitle: "Fast, safe, and always available",          badge: "LESS FARE", color: "brand",  action: navigateToRider },
    { icon: Car,         title: "Car",     subtitle: "Find the right car anytime!",               badge: "LESS FARE", color: "blue",   action: navigateToRider },
    { icon: Coffee,      title: "Food",    subtitle: "Order from the best nearby restaurants",    badge: null,        color: "green",  action: navigateToRider },
    { icon: Package,     title: "Parcel",  subtitle: "Instant delivery within the city",          badge: null,        color: "purple", action: navigateToRider },
    { icon: ShoppingBag, title: "Bazaar",  subtitle: "Shop essentials",                           badge: null,        color: "pink",   action: navigateToRider },
  ];

  const quickActions = [
    { icon: Home,   label: "Ride to Home",  action: navigateToRider },
    { icon: Star,   label: "Saved Places",  action: () => {} },
    { icon: Wallet, label: "Wallet",        action: () => {} },
    { icon: Zap,    label: "Promos",        action: () => {} },
  ];

  const spotlights = [
    { title: "Namlo Spotlight", subtitle: "Go Places with Namlo Rental",            bgColor: "from-purple-600 to-pink-600" },
    { title: "Summer Sale",     subtitle: "Sweet summer escape.",                    bgColor: "from-yellow-600 to-orange-600" },
    { title: "Resort Plans?",   subtitle: "Rental First! Pre-book & get discount.", bgColor: "from-green-600 to-teal-600" },
  ];

  // Whether to show the inline map panel beside the sidebar
  const showMapInSidebar = showMap && (activeTab === "rider" || activeTab === "driver");

  // ── Panel content (sidebar panels only — NOT for map tab) ───────────
  // CRITICAL: must be a regular function (not a component declared inline).
  // If we declare it as `const PanelContent = () => ...` and call it as
  // `<PanelContent />`, it gets a new identity on every Dashboard render.
  // React then treats the rendered tree as a different component type and
  // unmounts/remounts it on every state update — which is what caused the
  // "Maximum update depth exceeded" loop on the History tab (HistoryPanel's
  // mount effect called loadHistory → setHistory → Dashboard re-render →
  // new PanelContent ref → unmount/remount → repeat forever).
  const renderPanelContent = () => {
    if (activeTab === "home") {
      return (
        <div className="relative h-full">
          <div
            ref={homeScrollRef}
            className="h-full overflow-y-auto scrollbar-hide space-y-4 pb-4 px-4 pt-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="flex-shrink-0 mb-2">
              <p className="text-dark-400 text-sm">Welcome back,</p>
              <p className="text-white font-bold text-xl">{user?.name || "Guest"}</p>
            </div>

            <div>
              <h2 className="text-white font-bold text-lg mb-3">Services</h2>
              <div className="grid grid-cols-2 gap-3">
                {services.map((service, idx) => (
                  <ServiceCard key={idx} {...service} />
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-orange-400" />
                  <span className="text-white font-bold text-sm">HOT DEALS</span>
                </div>
                <ChevronRight size={14} className="text-dark-400" />
              </div>
            </div>

            <div>
              <h2 className="text-white font-bold text-lg mb-3">QUICK ACTIONS</h2>
              <div className="flex justify-around">
                {quickActions.map((action, idx) => (
                  <QuickAction key={idx} {...action} />
                ))}
              </div>
            </div>

            <PointsCard />

            <div>
              <h2 className="text-white font-bold text-lg mb-3">Namlo Spotlight</h2>
              <div className="overflow-x-auto flex gap-3 pb-2 scrollbar-hide">
                {spotlights.map((spotlight, idx) => (
                  <SpotlightCard key={idx} {...spotlight} />
                ))}
              </div>
            </div>

            <div className="mt-2 pb-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={navigateToDriver}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-4 shadow-lg shadow-blue-500/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                      <Truck size={24} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold text-lg">Drive with Namlo</p>
                      <p className="text-blue-200 text-xs">Earn money by driving</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-white" />
                </div>
              </motion.button>
            </div>
          </div>
          <ScrollButtons containerRef={homeScrollRef} color="brand" />
        </div>
      );
    }

    if (activeTab === "rider") {
      return (
        <div className="relative h-full">
          <div
            ref={riderScrollRef}
            className="h-full overflow-y-auto scrollbar-hide px-4 pt-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <RiderPanel />
            <div className="mt-4 pb-4">
              <SwitchHint role="rider" onSwitch={navigateToDriver} />
            </div>
          </div>
          <ScrollButtons containerRef={riderScrollRef} color="brand" />
        </div>
      );
    }

    if (activeTab === "driver") {
      return (
        <div className="relative h-full">
          <div
            ref={driverScrollRef}
            className="h-full overflow-y-auto scrollbar-hide px-4 pt-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <DriverPanel />
            <div className="mt-4 pb-4">
              <SwitchHint role="driver" onSwitch={navigateToRider} />
            </div>
          </div>
          <ScrollButtons containerRef={driverScrollRef} color="blue" />
        </div>
      );
    }

    if (activeTab === "history") {
      return (
        <div className="relative h-full">
          <div
            ref={historyScrollRef}
            className="h-full overflow-y-auto scrollbar-hide px-4 pt-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <HistoryPanel />
          </div>
          <ScrollButtons containerRef={historyScrollRef} color="purple" />
        </div>
      );
    }

    return null;
  };

  return (
    // Root: full-viewport column, nothing overflows
    <div className="h-screen bg-dark-950 text-white flex flex-col overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#f1f5f9",
            border: "1px solid #334155",
            borderRadius: "12px",
          },
        }}
      />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="bg-dark-900/80 backdrop-blur-xl border-b border-dark-800 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border border-dark-700"
          >
            {showMobileMenu ? <X size={16} /> : <Menu size={16} />}
          </button>

          <button onClick={navigateToHome} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Car size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-white text-lg">
              Namlo<span className="text-brand-500">Rides</span>
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-1 bg-dark-800/50 rounded-xl p-1">
          {[
            { key: "home",    label: "Home",    Icon: Home,       color: "bg-brand-500" },
            { key: "rider",   label: "Ride",    Icon: Navigation, color: "bg-brand-500" },
            { key: "driver",  label: "Drive",   Icon: Truck,      color: "bg-blue-500"  },
            { key: "map",     label: "Map",     Icon: Map,        color: "bg-green-500" },
            { key: "history", label: "History", Icon: Clock,      color: "bg-purple-500"},
          ].map(({ key, label, Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === key ? `${color} text-white` : "text-dark-400 hover:text-white"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(activeTab === "rider" || activeTab === "driver") && (
            <button
              onClick={toggleMapVisibility}
              className="flex w-8 h-8 bg-dark-800 rounded-lg items-center justify-center border border-dark-700 hover:border-brand-500/50 transition-all"
              title={showMap ? "Hide Map" : "Show Map"}
            >
              {showMap
                ? <EyeOff size={14} className="text-dark-400" />
                : <Eye    size={14} className="text-dark-400" />}
            </button>
          )}
          <button className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border border-dark-700">
            <Bell size={14} className="text-dark-400" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center text-xs font-bold shadow-lg">
              {user?.name?.[0] || "N"}
            </div>
            <button
              onClick={logout}
              className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-all border border-dark-700"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Ride status bar ──────────────────────────────────────── */}
      <AnimatePresence>{ride && <RideStatusBar ride={ride} />}</AnimatePresence>

      {/* ── Mobile slide-in menu ─────────────────────────────────── */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 shadow-2xl lg:hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Car size={20} className="text-brand-500" />
                  <span className="font-bold text-white">Menu</span>
                </div>
                <button onClick={() => setShowMobileMenu(false)}>
                  <X size={18} className="text-dark-400" />
                </button>
              </div>
              {[
                { label: "Home",    Icon: Home,       action: navigateToHome },
                { label: "Ride",    Icon: Navigation, action: navigateToRider },
                { label: "Drive",   Icon: Truck,      action: navigateToDriver },
                { label: "Map",     Icon: Map,        action: navigateToMap },
                { label: "History", Icon: Clock,      action: navigateToHistory },
              ].map(({ label, Icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full text-left px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-800 transition-colors flex items-center gap-2"
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
              <div className="pt-4 border-t border-dark-800">
                <button className="w-full text-left px-3 py-2 rounded-lg text-dark-400 hover:bg-dark-800 transition-colors flex items-center gap-2">
                  <Settings size={14} /> Settings
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg text-dark-400 hover:bg-dark-800 transition-colors flex items-center gap-2">
                  <HelpCircle size={14} /> Help
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main body: flex-1, no overflow on itself ─────────────── */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">

        {/* ── DESKTOP: Map tab — full-area map, no sidebar ─────────── */}
        {activeTab === "map" && (
          <div className="hidden lg:flex flex-1 overflow-hidden rounded-2xl bg-dark-900/60 border border-dark-800">
            {/*
              The map fills this container completely.
              We remove the fixed h-[600px] wrapper — RideMap must
              accept 100% width/height from its parent.
            */}
            <div className="flex flex-col flex-1 overflow-hidden p-4">
              <div className="flex-shrink-0 mb-3">
                <h2 className="text-white font-bold text-lg">Full Screen Map</h2>
                <p className="text-dark-400 text-xs">Click on map to select pickup/dropoff locations</p>
              </div>
              {/* This div grows to fill all remaining space */}
              <div className="flex-1 min-h-0 rounded-2xl overflow-hidden">
                <RideMap
                  onLocationSelect={handleMapLocationClick}
                  selectionMode={mapSelectionMode}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── DESKTOP: non-map tabs — sidebar + optional map panel ── */}
        {activeTab !== "map" && (
          <>
            {/* Sidebar panel */}
            <div
              className={`
                hidden lg:flex flex-col
                bg-dark-900/60 border border-dark-800 rounded-2xl overflow-hidden flex-shrink-0
                transition-all duration-300
                ${showMapInSidebar ? "w-[380px] xl:w-[420px]" : "w-full"}
              `}
            >
              <div className="flex-1 overflow-hidden">
                {renderPanelContent()}
              </div>
            </div>

            {/* Inline map panel (shown when eye icon toggled on rider/driver tab) */}
            {showMapInSidebar && (
              <div className="hidden lg:flex flex-1 min-w-0 overflow-hidden rounded-2xl bg-dark-900/60 border border-dark-800">
                <RideMap
                  onLocationSelect={handleMapLocationClick}
                  selectionMode={mapSelectionMode}
                />
              </div>
            )}
          </>
        )}

        {/* ── MOBILE layout ─────────────────────────────────────── */}
        <div className="lg:hidden flex-1 overflow-hidden flex flex-col rounded-2xl bg-dark-900/60 border border-dark-800 pb-16">
          {activeTab === "map" ? (
            // Mobile map tab: full-height map
            <div className="flex flex-col flex-1 overflow-hidden p-3">
              <div className="flex-shrink-0 mb-2">
                <h2 className="text-white font-bold text-base">Full Screen Map</h2>
                <p className="text-dark-400 text-xs">Click on map to select pickup/dropoff locations</p>
              </div>
              <div className="flex-1 min-h-0 rounded-xl overflow-hidden">
                <RideMap
                  onLocationSelect={handleMapLocationClick}
                  selectionMode={mapSelectionMode}
                />
              </div>
            </div>
          ) : (activeTab === "rider" || activeTab === "driver") && showMap ? (
            // Mobile rider/driver with map toggle on: panel on top, map strip below
            <>
              <div className="flex-1 overflow-hidden min-h-0">
                {renderPanelContent()}
              </div>
              <div className="h-64 flex-shrink-0 overflow-hidden border-t border-dark-800 p-3">
                <div className="h-full rounded-xl overflow-hidden">
                  <RideMap
                    onLocationSelect={handleMapLocationClick}
                    selectionMode={mapSelectionMode}
                  />
                </div>
              </div>
            </>
          ) : (
            // Mobile default: just the panel
            <div className="flex-1 overflow-hidden">
              {renderPanelContent()}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Navigation (Mobile) ────────────────────────────── */}
      <div className="lg:hidden bg-dark-900/80 backdrop-blur-xl border-t border-dark-800 px-4 py-2 flex items-center justify-around fixed bottom-0 left-0 right-0 z-10">
        {[
          { key: "home",    label: "Home",    Icon: Home,       color: "text-brand-500"  },
          { key: "rider",   label: "Ride",    Icon: Navigation, color: "text-brand-500"  },
          { key: "driver",  label: "Drive",   Icon: Truck,      color: "text-blue-500"   },
          { key: "map",     label: "Map",     Icon: Map,        color: "text-green-500"  },
          { key: "history", label: "History", Icon: Clock,      color: "text-purple-500" },
        ].map(({ key, label, Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              activeTab === key ? color : "text-dark-500"
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Payment modal (rendered globally so tab switches can't strand it) ─ */}
      {ride?.status === RIDE_STATUS.COMPLETED && (
        <DraggablePaymentModal ride={ride} onClear={clearRide} />
      )}
    </div>
  );
}