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
import DriverPanel from "./Driver/DriverPanel";
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
  const color = role === "rider" ? "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" : "text-brand-400 border-brand-500/30 hover:bg-brand-500/10";

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
      className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-2 flex items-center gap-3 text-xs"
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

// ── Scroll to Top/Bottom Button Component ─────────────────────────────────────
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
      container.addEventListener('scroll', checkScroll);
      checkScroll();
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const bgColor = color === "brand" ? "bg-brand-500/80 hover:bg-brand-500" : color === "blue" ? "bg-blue-500/80 hover:bg-blue-500" : "bg-purple-500/80 hover:bg-purple-500";

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
  const { ride, handleMapLocationClick, mapSelectionMode, setMapSelectionMode } = useRide();
  const [activeTab, setActiveTab] = useState("home");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  const homeScrollRef = useRef(null);
  const riderScrollRef = useRef(null);
  const driverScrollRef = useRef(null);
  const historyScrollRef = useRef(null);
  const mapScrollRef = useRef(null);

  // Navigation functions
  const navigateToHome = () => {
    setActiveTab("home");
    setShowMobileMenu(false);
  };

  const navigateToRider = () => {
    setActiveTab("rider");
    setShowMobileMenu(false);
  };

  const navigateToDriver = () => {
    setActiveTab("driver");
    setShowMobileMenu(false);
  };

  const navigateToHistory = () => {
    setActiveTab("history");
    setShowMobileMenu(false);
  };

  const navigateToMap = () => {
    setActiveTab("map");
    setShowMobileMenu(false);
  };

  const toggleMapVisibility = () => {
    setShowMap(!showMap);
  };

  const services = [
    { icon: Bike, title: "Bike", subtitle: "Fast, safe, and always available", badge: "LESS FARE", color: "brand", action: navigateToRider },
    { icon: Car, title: "Car", subtitle: "Find the right car anytime!", badge: "LESS FARE", color: "blue", action: navigateToRider },
    { icon: Coffee, title: "Food", subtitle: "Order from the best nearby restaurants", badge: null, color: "green", action: navigateToRider },
    { icon: Package, title: "Parcel", subtitle: "Instant delivery within the city", badge: null, color: "purple", action: navigateToRider },
    { icon: ShoppingBag, title: "Bazaar", subtitle: "Shop essentials", badge: null, color: "pink", action: navigateToRider },
  ];

  const quickActions = [
    { icon: Home, label: "Ride to Home", action: navigateToRider },
    { icon: Star, label: "Saved Places", action: () => {} },
    { icon: Wallet, label: "Wallet", action: () => {} },
    { icon: Zap, label: "Promos", action: () => {} },
  ];

  const spotlights = [
    { title: "Namlo Spotlight", subtitle: "Go Places with Namlo Rental", bgColor: "from-purple-600 to-pink-600" },
    { title: "Summer Sale", subtitle: "Sweet summer escape.", bgColor: "from-yellow-600 to-orange-600" },
    { title: "Resort Plans?", subtitle: "Rental First! Pre-book & get discount.", bgColor: "from-green-600 to-teal-600" },
  ];

  const PanelContent = () => {
    if (activeTab === "home") {
      return (
        <div className="relative h-full">
          <div 
            ref={homeScrollRef}
            className="h-full overflow-y-auto scrollbar-hide space-y-4 pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
            className="h-full overflow-y-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <RiderPanel />
            <div className="mt-4">
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
            className="h-full overflow-y-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <DriverPanel />
            <div className="mt-4">
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
            className="h-full overflow-y-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <HistoryPanel />
          </div>
          <ScrollButtons containerRef={historyScrollRef} color="purple" />
        </div>
      );
    }

    if (activeTab === "map") {
      return (
        <div className="relative h-full">
          <div 
            ref={mapScrollRef}
            className="h-full overflow-y-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="mb-4">
              <h2 className="text-white font-bold text-lg mb-2">Full Screen Map</h2>
              <p className="text-dark-400 text-xs">Click on map to select pickup/dropoff locations</p>
            </div>
            <div className="h-[600px] w-full rounded-2xl overflow-hidden">
              <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Determine if map should be visible in sidebar (only for Rider/Driver tabs and when showMap is true)
  const showMapInSidebar = showMap && (activeTab === "rider" || activeTab === "driver");

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
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
          <button onClick={navigateToHome} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "home" ? "bg-brand-500 text-white" : "text-dark-400 hover:text-white"}`}><Home size={14} /> Home</button>
          <button onClick={navigateToRider} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "rider" ? "bg-brand-500 text-white" : "text-dark-400 hover:text-white"}`}><Navigation size={14} /> Ride</button>
          <button onClick={navigateToDriver} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "driver" ? "bg-blue-500 text-white" : "text-dark-400 hover:text-white"}`}><Truck size={14} /> Drive</button>
          <button onClick={navigateToMap} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "map" ? "bg-green-500 text-white" : "text-dark-400 hover:text-white"}`}><Map size={14} /> Map</button>
          <button onClick={navigateToHistory} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "history" ? "bg-purple-500 text-white" : "text-dark-400 hover:text-white"}`}><Clock size={14} /> History</button>
        </div>

        <div className="flex items-center gap-2">
          {(activeTab === "rider" || activeTab === "driver") && (
            <button onClick={toggleMapVisibility} className="flex w-8 h-8 bg-dark-800 rounded-lg items-center justify-center border border-dark-700 hover:border-brand-500/50 transition-all" title={showMap ? "Hide Map" : "Show Map"}>
              {showMap ? <EyeOff size={14} className="text-dark-400" /> : <Eye size={14} className="text-dark-400" />}
            </button>
          )}
          <button className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border border-dark-700"><Bell size={14} className="text-dark-400" /></button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center text-xs font-bold shadow-lg">{user?.name?.[0] || "N"}</div>
            <button onClick={logout} className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-all border border-dark-700"><LogOut size={14} /></button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showMobileMenu && (
          <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 shadow-2xl lg:hidden">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2"><Car size={20} className="text-brand-500" /><span className="font-bold text-white">Menu</span></div><button onClick={() => setShowMobileMenu(false)}><X size={18} className="text-dark-400" /></button></div>
              <button onClick={navigateToHome} className="w-full text-left px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-800 transition-colors flex items-center gap-2"><Home size={16} /> Home</button>
              <button onClick={navigateToRider} className="w-full text-left px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-800 transition-colors flex items-center gap-2"><Navigation size={16} /> Ride</button>
              <button onClick={navigateToDriver} className="w-full text-left px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-800 transition-colors flex items-center gap-2"><Truck size={16} /> Drive</button>
              <button onClick={navigateToMap} className="w-full text-left px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-800 transition-colors flex items-center gap-2"><Map size={16} /> Map</button>
              <button onClick={navigateToHistory} className="w-full text-left px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-800 transition-colors flex items-center gap-2"><Clock size={16} /> History</button>
              <div className="pt-4 border-t border-dark-800">
                <button className="w-full text-left px-3 py-2 rounded-lg text-dark-400 hover:bg-dark-800 transition-colors flex items-center gap-2"><Settings size={14} /> Settings</button>
                <button className="w-full text-left px-3 py-2 rounded-lg text-dark-400 hover:bg-dark-800 transition-colors flex items-center gap-2"><HelpCircle size={14} /> Help</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{ride && <RideStatusBar ride={ride} />}</AnimatePresence>

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden p-4">
        {/* Desktop Sidebar - Shows panel content (no map inside) */}
        {activeTab !== "map" && (
          <div className={`${showMapInSidebar ? 'lg:w-[400px] xl:w-[450px]' : 'lg:w-full'} flex-shrink-0 flex-col bg-dark-900/60 border-r border-dark-800 transition-all duration-300 hidden lg:flex rounded-2xl overflow-hidden`}>
            <div className="flex-1 overflow-hidden">
              <PanelContent />
            </div>
          </div>
        )}

        {/* Desktop Map - Shows ONLY when activeTab is "map" */}
        {activeTab === "map" && (
          <div className="hidden lg:flex flex-1 overflow-hidden rounded-2xl bg-dark-900/60 border border-dark-800">
            <PanelContent />
          </div>
        )}

        {/* Desktop Map Toggle - Shows map beside panel when showMapInSidebar is true */}
        {showMapInSidebar && activeTab !== "map" && (
          <div className="hidden lg:block flex-1 overflow-hidden ml-4 rounded-2xl bg-dark-900/60 border border-dark-800 shadow-lg">
            <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
          </div>
        )}

        {/* Mobile Layout */}
        <div className="lg:hidden flex-1 overflow-hidden flex flex-col rounded-2xl bg-dark-900/60 border border-dark-800">
          {activeTab === "map" ? (
            <div className="flex-1 overflow-hidden p-3">
              <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
            </div>
          ) : activeTab === "rider" || activeTab === "driver" ? (
            showMap ? (
              <>
                <div className="flex-1 overflow-hidden"><PanelContent /></div>
                <div className="h-64 flex-shrink-0 p-3 overflow-hidden border-t border-dark-800">
                  <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-hidden"><PanelContent /></div>
            )
          ) : (
            <div className="flex-1 overflow-hidden"><PanelContent /></div>
          )}
        </div>
      </div>

      {/* Bottom Navigation (Mobile) */}
      <div className="lg:hidden bg-dark-900/80 backdrop-blur-xl border-t border-dark-800 px-4 py-2 flex items-center justify-around fixed bottom-0 left-0 right-0 z-10">
        <button onClick={navigateToHome} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${activeTab === "home" ? "text-brand-500" : "text-dark-500"}`}><Home size={20} /><span className="text-[10px]">Home</span></button>
        <button onClick={navigateToRider} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${activeTab === "rider" ? "text-brand-500" : "text-dark-500"}`}><Navigation size={20} /><span className="text-[10px]">Ride</span></button>
        <button onClick={navigateToDriver} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${activeTab === "driver" ? "text-blue-500" : "text-dark-500"}`}><Truck size={20} /><span className="text-[10px]">Drive</span></button>
        <button onClick={navigateToMap} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${activeTab === "map" ? "text-green-500" : "text-dark-500"}`}><Map size={20} /><span className="text-[10px]">Map</span></button>
        <button onClick={navigateToHistory} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${activeTab === "history" ? "text-purple-500" : "text-dark-500"}`}><Clock size={20} /><span className="text-[10px]">History</span></button>
      </div>
    </div>
  );
}