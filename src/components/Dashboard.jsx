// src/components/Dashboard.jsx
import React, { useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Navigation, Truck, Clock, LogOut, Activity,
  ChevronRight, Home, Star, Wallet, Menu, X,
  Bell, Settings, HelpCircle, Award, Zap,
  Bike, Package, Coffee, ShoppingBag, Map, Eye, EyeOff,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useAuth } from "../store/AuthContext";
import { useRide } from "../store/RideContext";
import { RIDE_STATUS } from "../lib/rideStates";
import RideMap from "./Map/RideMap";

// ── Helpers ────────────────────────────────────────────────────────────────────
function ServiceCard({ icon: Icon, title, subtitle, badge, color, onClick, isActive }) {
  const colorMap = {
    brand:  "from-brand-500 to-orange-600",
    blue:   "from-blue-500 to-blue-600",
    green:  "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    pink:   "from-pink-500 to-pink-600",
  };
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative bg-dark-800/80 backdrop-blur-sm border rounded-2xl p-4 text-left hover:border-brand-500/50 transition-all w-full ${
        isActive ? 'border-brand-500/50 ring-2 ring-brand-500/30' : 'border-dark-700'
      }`}
    >
      {badge && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[color]} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
        <Icon size={22} className="text-white" />
      </div>
      <h3 className="text-white font-bold text-base">{title}</h3>
      <p className="text-dark-400 text-xs mt-0.5">{subtitle}</p>
    </motion.button>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className="w-12 h-12 bg-dark-800 rounded-full flex items-center justify-center border border-dark-700 hover:border-brand-500/50 transition-all group">
        <Icon size={20} className="text-dark-400 group-hover:text-brand-400 transition-colors" />
      </div>
      <span className="text-[10px] text-dark-400">{label}</span>
    </motion.button>
  );
}

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
        <motion.button whileHover={{ scale: 1.05 }} className="px-3 py-1.5 bg-brand-500/20 border border-brand-500/40 rounded-lg text-brand-400 text-xs font-medium">
          Redeem now
        </motion.button>
      </div>
      <p className="text-dark-500 text-[10px] mt-2">9 deals available</p>
    </div>
  );
}

function SpotlightCard({ title, subtitle, bgColor }) {
  return (
    <div className={`bg-gradient-to-r ${bgColor} rounded-2xl p-4 min-w-[200px] flex-shrink-0`}>
      <p className="text-white font-bold text-sm">{title}</p>
      <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>
    </div>
  );
}

// ── Ride Status Bar (live banner under header) ─────────────────────────────────
function RideStatusBar({ ride }) {
  const active = [
    RIDE_STATUS.REQUESTING, RIDE_STATUS.PROCESSING,
    RIDE_STATUS.ACCEPTED, RIDE_STATUS.ARRIVED, RIDE_STATUS.ACTIVE,
  ].includes(ride?.status);
  if (!active) return null;
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

// ── Scroll Buttons ─────────────────────────────────────────────────────────────
function ScrollButtons({ containerRef, color = "brand" }) {
  const [showTop, setShowTop]       = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      setShowTop(el.scrollTop > 100);
      setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 100);
    };
    el.addEventListener("scroll", check);
    check();
    return () => el.removeEventListener("scroll", check);
  }, [containerRef]);

  const bg =
    color === "blue"   ? "bg-blue-500/80 hover:bg-blue-500" :
    color === "purple" ? "bg-purple-500/80 hover:bg-purple-500" :
                         "bg-brand-500/80 hover:bg-brand-500";

  return (
    <div className="absolute right-3 bottom-4 flex flex-col gap-2 z-20 pointer-events-none">
      <AnimatePresence>
        {showTop && (
          <motion.button
            key="top"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className={`pointer-events-auto w-8 h-8 ${bg} rounded-full flex items-center justify-center shadow-lg`}
          >
            <ArrowUp size={14} className="text-white" />
          </motion.button>
        )}
        {showBottom && (
          <motion.button
            key="bottom"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" })}
            className={`pointer-events-auto w-8 h-8 ${bg} rounded-full flex items-center justify-center shadow-lg`}
          >
            <ArrowDown size={14} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Home Panel ─────────────────────────────────────────────────────────────────
function HomePanel({ user, navigate, selectedService, setSelectedService }) {
  const scrollRef = useRef(null);

  // Service configurations with their ride types
  const services = [
    { 
      id: 'bike',
      icon: Bike,        
      title: "Bike",    
      subtitle: "Fast & always available",           
      badge: "LESS FARE", 
      color: "brand",  
      rideType: 'bike',
      path: "/rider" 
    },
    { 
      id: 'car',
      icon: Car,         
      title: "Car",     
      subtitle: "Find the right car anytime",        
      badge: "LESS FARE", 
      color: "blue",   
      rideType: 'car',
      path: "/rider" 
    },
    { 
      id: 'food',
      icon: Coffee,      
      title: "Food",    
      subtitle: "Order from nearby restaurants",     
      badge: null,        
      color: "green",  
      rideType: 'food',
      path: "/rider" 
    },
    { 
      id: 'parcel',
      icon: Package,     
      title: "Parcel",  
      subtitle: "Instant delivery in the city",      
      badge: null,        
      color: "purple", 
      rideType: 'parcel',
      path: "/rider" 
    },
    { 
      id: 'bazaar',
      icon: ShoppingBag, 
      title: "Bazaar",  
      subtitle: "Shop essentials",                   
      badge: null,        
      color: "pink",   
      rideType: 'bazaar',
      path: "/rider" 
    },
  ];

  const handleServiceClick = (service) => {
    // Store selected service type in state/context
    setSelectedService(service.rideType);
    
    // Navigate to rider panel with service type in state
    navigate(service.path, { 
      state: { 
        serviceType: service.rideType,
        serviceName: service.title 
      } 
    });
  };

  const quickActions = [
    { icon: Home,   label: "Ride Home",    onClick: () => navigate("/rider") },
    { icon: Star,   label: "Saved",        onClick: () => {} },
    { icon: Wallet, label: "Wallet",       onClick: () => {} },
    { icon: Zap,    label: "Promos",       onClick: () => {} },
  ];
  const spotlights = [
    { title: "Namlo Spotlight",  subtitle: "Go Places with Namlo Rental",            bgColor: "from-purple-600 to-pink-600" },
    { title: "Summer Sale",      subtitle: "Sweet summer escape.",                   bgColor: "from-yellow-600 to-orange-600" },
    { title: "Resort Plans?",    subtitle: "Pre-book & get discount.",               bgColor: "from-green-600 to-teal-600" },
  ];

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-6 space-y-5">
        {/* Welcome */}
        <div>
          <p className="text-dark-400 text-sm">Welcome back,</p>
          <p className="text-white font-bold text-xl">{user?.name || "Guest"}</p>
        </div>

        {/* Services grid */}
        <div>
          <h2 className="text-white font-bold text-base mb-3">Services</h2>
          <div className="grid grid-cols-2 gap-3">
            {services.map((s) => (
              <ServiceCard 
                key={s.id} 
                {...s} 
                onClick={() => handleServiceClick(s)}
                isActive={selectedService === s.rideType}
              />
            ))}
          </div>
        </div>

        {/* Hot deals banner */}
        <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-orange-400" />
            <span className="text-white font-bold text-sm">HOT DEALS</span>
          </div>
          <ChevronRight size={14} className="text-dark-400" />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-white font-bold text-base mb-3">Quick Actions</h2>
          <div className="flex justify-around">
            {quickActions.map((a, i) => <QuickAction key={i} icon={a.icon} label={a.label} onClick={a.onClick} />)}
          </div>
        </div>

        <PointsCard />

        {/* Spotlight carousel */}
        <div>
          <h2 className="text-white font-bold text-base mb-3">Namlo Spotlight</h2>
          <div className="overflow-x-auto flex gap-3 pb-1 scrollbar-hide">
            {spotlights.map((s, i) => <SpotlightCard key={i} {...s} />)}
          </div>
        </div>

        {/* Drive CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/driver")}
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
      <ScrollButtons containerRef={scrollRef} color="brand" />
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout }     = useAuth();
  const { ride, handleMapLocationClick, mapSelectionMode } = useRide();
  const navigate             = useNavigate();
  const location             = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [selectedService, setSelectedService] = useState(null);

  // Derive active tab from URL
  const path = location.pathname.replace("/", "") || "home";
  const activeTab = ["rider", "driver", "history", "map"].includes(path) ? path : "home";

  const go = (tab) => {
    setShowMobileMenu(false);
    navigate(tab === "home" ? "/" : `/${tab}`);
  };

  const navItems = [
    { key: "home",    label: "Home",    Icon: Home,       color: "text-brand-500" },
    { key: "rider",   label: "Ride",    Icon: Navigation, color: "text-brand-500" },
    { key: "driver",  label: "Drive",   Icon: Truck,      color: "text-blue-400"  },
    { key: "map",     label: "Map",     Icon: Map,        color: "text-green-400" },
    { key: "history", label: "History", Icon: Clock,      color: "text-purple-400"},
  ];

  // Should the map panel sit beside the content panel?
  const showSideMap = showMap && (activeTab === "rider" || activeTab === "driver");
  // Is this the dedicated full-map tab?
  const isMapTab = activeTab === "map";

  // Scroll color per panel
  const scrollColor =
    activeTab === "driver" ? "blue" :
    activeTab === "history" ? "purple" : "brand";

  const panelScrollRef = useRef(null);

  return (
    <div className="h-screen bg-dark-950 text-white flex flex-col overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155", borderRadius: "12px" },
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-dark-900/90 backdrop-blur-xl border-b border-dark-800 px-4 py-3 flex items-center justify-between z-30">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border border-dark-700"
          >
            {showMobileMenu ? <X size={16} /> : <Menu size={16} />}
          </button>
          <button onClick={() => { setSelectedService(null); go("home"); }} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Car size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-white text-lg hidden sm:block">
              Namlo<span className="text-brand-500">Rides</span>
            </span>
          </button>
        </div>

        {/* Desktop nav pills */}
        <nav className="hidden lg:flex items-center gap-1 bg-dark-800/50 rounded-xl p-1">
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setSelectedService(null); go(key); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === key
                  ? "bg-brand-500 text-white"
                  : "text-dark-400 hover:text-white hover:bg-dark-700"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        {/* Right: map toggle + bells + avatar */}
        <div className="flex items-center gap-2">
          {(activeTab === "rider" || activeTab === "driver") && (
            <button
              onClick={() => setShowMap((v) => !v)}
              className="hidden lg:flex w-8 h-8 bg-dark-800 rounded-lg items-center justify-center border border-dark-700 hover:border-brand-500/50 transition-all"
              title={showMap ? "Hide map" : "Show map"}
            >
              {showMap
                ? <EyeOff size={14} className="text-dark-400" />
                : <Eye    size={14} className="text-dark-400" />}
            </button>
          )}
          <button className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border border-dark-700">
            <Bell size={14} className="text-dark-400" />
          </button>
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
      </header>

      {/* ── Live ride status bar ───────────────────────────────────────────── */}
      <AnimatePresence>{ride && <RideStatusBar ride={ride} />}</AnimatePresence>

      {/* ── Mobile slide-in drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 shadow-2xl lg:hidden flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-dark-800">
                <div className="flex items-center gap-2">
                  <Car size={20} className="text-brand-500" />
                  <span className="font-bold text-white">Menu</span>
                </div>
                <button onClick={() => setShowMobileMenu(false)}>
                  <X size={18} className="text-dark-400" />
                </button>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-1">
                {navItems.map(({ key, label, Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => { setSelectedService(null); go(key); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                      activeTab === key
                        ? "bg-dark-800 text-white"
                        : "text-dark-300 hover:bg-dark-800 hover:text-white"
                    }`}
                  >
                    <Icon size={16} className={activeTab === key ? color : "text-dark-500"} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-dark-800 space-y-1">
                <button className="w-full text-left px-3 py-2 rounded-xl text-dark-400 hover:bg-dark-800 flex items-center gap-2">
                  <Settings size={14} /> Settings
                </button>
                <button className="w-full text-left px-3 py-2 rounded-xl text-dark-400 hover:bg-dark-800 flex items-center gap-2">
                  <HelpCircle size={14} /> Help
                </button>
                <button onClick={logout} className="w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-dark-800 flex items-center gap-2">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DESKTOP layout ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-h-0 p-4 gap-4 overflow-hidden">

        {/* Full-screen map tab */}
        {isMapTab && (
          <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-dark-800">
            <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
          </div>
        )}

        {/* Panel + optional side map */}
        {!isMapTab && (
          <>
            {/* Content panel — fixed width when map is shown, full-width otherwise */}
            <div
              className={`flex flex-col rounded-2xl bg-dark-900/60 border border-dark-800 overflow-hidden flex-shrink-0 transition-all duration-300 ${
                showSideMap ? "w-[400px] xl:w-[440px]" : "w-full"
              }`}
            >
              {activeTab === "home" ? (
                <HomePanel 
                  user={user} 
                  navigate={navigate} 
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
              ) : (
                /* Outlet renders the nested route's component (RiderPanel, DriverPanel, HistoryPanel) */
                <div className="relative flex-1 min-h-0 overflow-hidden">
                  <div ref={panelScrollRef} className="h-full overflow-y-auto scrollbar-hide px-4 pt-4 pb-6">
                    <Outlet context={{ selectedService }} />
                  </div>
                  <ScrollButtons containerRef={panelScrollRef} color={scrollColor} />
                </div>
              )}
            </div>

            {/* Side map — always mounted, toggled via CSS visibility so Leaflet stays alive */}
            <div
              className={`flex-1 min-w-0 rounded-2xl overflow-hidden border border-dark-800 transition-all duration-300 ${
                showSideMap ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none w-0 p-0 border-0"
              }`}
            >
              <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
            </div>
          </>
        )}
      </div>

      {/* ── MOBILE layout ─────────────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 min-h-0 overflow-hidden flex flex-col pb-16">
        {isMapTab ? (
          /* Full-screen map */
          <div className="flex-1 min-h-0 m-3 rounded-2xl overflow-hidden border border-dark-800">
            <RideMap onLocationSelect={handleMapLocationClick} selectionMode={mapSelectionMode} />
          </div>
        ) : (
          /* Panel: scrollable content */
          <div className="flex-1 min-h-0 m-3 rounded-2xl bg-dark-900/60 border border-dark-800 overflow-hidden flex flex-col">
            {activeTab === "home" ? (
              <HomePanel 
                user={user} 
                navigate={navigate}
                selectedService={selectedService}
                setSelectedService={setSelectedService}
              />
            ) : (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div ref={panelScrollRef} className="h-full overflow-y-auto scrollbar-hide px-4 pt-4 pb-6">
                  <Outlet context={{ selectedService }} />
                </div>
                <ScrollButtons containerRef={panelScrollRef} color={scrollColor} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom nav (mobile only) ───────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-dark-900/90 backdrop-blur-xl border-t border-dark-800 flex items-center justify-around px-2 py-2 safe-b">
        {navItems.map(({ key, label, Icon, color }) => (
          <button
            key={key}
            onClick={() => { setSelectedService(null); go(key); }}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
              activeTab === key ? color : "text-dark-500"
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}