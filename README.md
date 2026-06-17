# 🚕 NamloRides — Real-Time Ride-Sharing Simulator

> Namlo Technologies Frontend Intern Challenge Submission  
> A dual-role real-time ride-sharing simulation platform centered around Kathmandu, Nepal.

---

## 🌐 Live Demo

**Deployment URL:** `https://namlo-rides.vercel.app` *(replace with your Vercel URL)*

**Test Credentials:**
```
Username: intern@namlotech.com
Password: namlo2026
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/namlo-rides.git
cd namlo-rides
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Then edit `.env` with your Firebase and MockAPI credentials (see setup guides below).

### 3. Run

```bash
npm start
# Opens http://localhost:3000
```

---

## 🔧 Backend Setup (Required for Full Functionality)

This app uses **no custom backend**. All real-time and persistence is handled by free cloud services.

---

### 🔥 Firebase Realtime Database (Live Ride Sync)

Used for: live driver position updates, ride status sync across windows.

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name → Continue
3. Once created, click **Add app** → choose **Web** (`</>`)
4. Register the app → copy the `firebaseConfig` object
5. In Firebase Console sidebar: **Build → Realtime Database → Create database**
6. Choose your region → start in **test mode** (allows public read/write for demo)
7. Copy your values into `.env`:

```env
REACT_APP_FIREBASE_API_KEY=AIza...
REACT_APP_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://yourproject-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=yourproject
REACT_APP_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

> **Firebase Rules for demo** (Realtime Database → Rules tab):
> ```json
> { "rules": { ".read": true, ".write": true } }
> ```

---

### 📦 MockAPI.io (Ride History REST API)

Used for: persisting completed/cancelled/rejected rides via HTTP POST, displaying history via GET.

1. Sign up at [https://mockapi.io](https://mockapi.io) (free)
2. Create a **New Project** → name it `namlo-rides`
3. Click **New Resource** → name it `rides`
4. Add these fields (all as **String** type):
   - `rideId`, `riderId`, `riderName`, `driverName`, `vehicleType`, `plate`
   - `pickup`, `dropoff`, `status`, `fare`, `distance`, `duration`
   - `createdAt`, `completedAt`
5. Copy the base endpoint URL (e.g. `https://abc123.mockapi.io/api/v1`)
6. Set in `.env`:

```env
REACT_APP_MOCKAPI_URL=https://abc123.mockapi.io/api/v1
```

---

## ☁️ Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel
# Follow prompts → Framework: Create React App
```

Then add your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Option B: GitHub Integration

1. Push your repo to GitHub
2. Go to [https://vercel.com/new](https://vercel.com/new) → Import your repo
3. Framework: **Create React App** (auto-detected)
4. Add all `REACT_APP_*` variables under **Environment Variables**
5. Click **Deploy**

---

## 🏗️ Architecture

### Hybrid Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│                                                             │
│  ┌─────────────┐    WebSocket     ┌──────────────────────┐  │
│  │  RideContext│◄────────────────►│  Firebase Realtime   │  │
│  │  (state     │   (live position │  Database            │  │
│  │   machine)  │    & ride sync)  │  (high-frequency)    │  │
│  └──────┬──────┘                  └──────────────────────┘  │
│         │                                                   │
│         │ HTTP REST (on terminal states only)               │
│         ▼                                                   │
│  ┌──────────────┐                 ┌──────────────────────┐  │
│  │  api.js      │────────────────►│  MockAPI.io          │  │
│  │  (axios)     │  POST /rides    │  (persistent history)│  │
│  └──────────────┘  GET  /rides    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key separation:**
- **Firebase** handles sub-second positional updates (WebSocket stream, ~200ms intervals)  
- **MockAPI** handles durable records only when a ride reaches a terminal state (completed / cancelled / rejected)

---

### State Machine

```
IDLE ──► REQUESTING ──► PROCESSING ──► ACCEPTED ──► ARRIVED ──► ACTIVE ──► COMPLETED
                  │                │                                          (terminal)
                  │                └──────────────────────────────────────► REJECTED
                  │                                                           (terminal)
                  └─────────────────────────────────────────────────────► CANCELLED
                                                                             (terminal)
                                                                          NO_DRIVER
                                                                             (terminal)
```

All terminal states trigger a REST POST to MockAPI for persistence.

---

### Rendering Optimization

- **`memo()`** wraps `RideMap` to prevent re-renders from unrelated state changes  
- Firebase `onValue` listeners are attached once in a `useEffect` and cleaned up on unmount  
- Driver position animation uses `setInterval` (200ms ticks) with proper `clearInterval` cleanup  
- Leaflet `MapContainer` is never unmounted — only `MapRecenter` updates the view via `flyTo`  
- `AnimatePresence` with `mode="wait"` prevents stacking render artifacts during panel transitions  

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Auth/
│   │   └── Login.jsx            # Auth screen with hardcoded credentials
│   ├── Map/
│   │   └── RideMap.jsx          # Leaflet map (memoized, dark tiles)
│   ├── Rider/
│   │   └── RiderPanel.jsx       # Ride booking UI + status display
│   ├── Driver/
│   │   └── DriverPanel.jsx      # Accept/reject + start ride flow
│   ├── History/
│   │   └── HistoryPanel.jsx     # REST API ride history viewer
│   └── Dashboard.jsx            # Main layout with tab navigation
├── store/
│   ├── AuthContext.js           # Login state
│   └── RideContext.js           # Core ride state machine + Firebase + API
├── lib/
│   ├── firebase.js              # Firebase init
│   ├── api.js                   # MockAPI axios wrapper
│   └── rideStates.js            # State constants, geo helpers, fare calc
├── index.css                    # Tailwind + Leaflet dark overrides
├── index.js                     # React root
└── App.js                       # Auth gate → Dashboard
```

---

## 🎨 Design Decisions

- **Dark theme** (#020617 base) with brand orange (#f97316) — high contrast for outdoor/mobile use  
- **Framer Motion** for all state transitions — smooth panel switches, card entrances  
- **Kathmandu-centered map** defaulting to `[27.7172, 85.3240]` with CARTO dark tiles  
- **Two-viewport design** — side-by-side browser windows simulate real Rider + Driver interaction  
- **Mobile-first responsive** — full tab navigation on mobile, sidebar + map split on desktop  

---

## 📝 Notes for Evaluators

1. Open **two browser windows** to simulate both Rider and Driver simultaneously
2. In Window 1: select Rider tab → choose locations → Book Ride  
3. In Window 2: select Driver tab → Accept the incoming request  
4. Watch the map update in real-time via Firebase WebSocket  
5. After ride completes, check History tab to see the REST-persisted record

---

*Built for Namlo Technologies Pvt. Ltd. Frontend Intern Challenge*
