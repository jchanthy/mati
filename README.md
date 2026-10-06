# Mati (មតិ) - Real-Time Audience Polling & Q&A System

**Mati (មតិ)** ("Opinion / Voice" in Khmer) is a lightning-fast, real-time audience polling and live Q&A platform built with Angular 19+ (Standalone Components, Signals), PrimeNG v19+ (Aura / Sakai design tokens), Firebase Firestore (`@angular/fire`), and Tailwind / PrimeFlex.

---

## 🚀 Distinct View Layouts

1. **Teacher Dashboard (Sakai Shell - `/dashboard`)**:
   - Branded as **Mati Studio**.
   - Create rooms with 6-character PINs (e.g. `MATI01`), compose questions & options, and launch questions to the live stage.
   - Live Controller (`/dashboard/control`): remote with Next/Prev question navigation, "Lock Voting" toggle, and "Show / Hide Results" toggle.
2. **Presenter Stage (`/stage/:roomCode` - Blank Shell)**:
   - Fullscreen presentation view optimized for projectors & TVs.
   - Dynamic real-time join QR code (`qrcode`) pointing to `${origin}/join/:roomCode`.
   - Large room PIN and live animated progress bars with percentage and vote tallies.
   - **Hidden Results Overlay Mode**: displays a clean "Voting in progress..." card when the presenter wants to withhold live tallies.
3. **Student Mobile View (`/join/:roomCode` - Minimal Shell)**:
   - Ultra-fast, lightweight mobile container.
   - Anonymous persistent voter ID in `localStorage` (`mati_voter_id`).
   - Large touch-friendly option buttons, immediate vote confirmation, and locked state notifications.

---

## 🛠️ Data Architecture (Firestore)

Atomic sub-collection structure for high concurrency and low contention:

```
/rooms/{roomCode}
  ├── code: string (e.g. "MATI01")
  ├── title: string
  ├── activePollId: string | null
  ├── status: 'draft' | 'active' | 'closed'
  └── createdAt: timestamp

/rooms/{roomCode}/polls/{pollId}
  ├── id: string
  ├── question: string
  ├── type: 'multiple_choice'
  ├── order: number
  ├── isLocked: boolean
  ├── showResults: boolean
  └── options: Array<{ id: number, text: string }>

/rooms/{roomCode}/polls/{pollId}/votes/{voterId}
  ├── voterId: string (client UUID / localStorage ID)
  ├── optionId: number
  └── timestamp: timestamp
```

---

## 🏃 Running the Application

### 1. Development Server
```bash
npm start
# Runs on http://localhost:4200
```

### 2. Available Routes
- **Teacher Dashboard**: `http://localhost:4200/dashboard`
- **Live Remote Control**: `http://localhost:4200/dashboard/control`
- **Presenter Stage**: `http://localhost:4200/stage/MATI01`
- **Participant Mobile**: `http://localhost:4200/join/MATI01`

### 3. Production Build
```bash
npm run build
```
The compiled artifacts will be output to `dist/mati-app`.
