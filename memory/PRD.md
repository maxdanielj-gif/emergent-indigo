# indigo AI — PRD

## Original Problem Statement
Import the GitHub repo (maxdanielj-gif/indigo) as-is and add tweaks:
- Add Stability AI as a 3rd image generation provider (keep Freepik Mystic & WaveSpeed)
- Add MongoDB persistent backend storage
- Add Firebase Firestore cloud backup/restore

## Architecture

### Stack
- **Frontend + Backend**: Node.js / TypeScript / Express + Vite / React (single process on port 3000)
- **Proxy**: Python FastAPI on port 8001 forwards /api/* to Node on 3000
- **Database**: MongoDB (localhost:27017, db: indigo_ai) — used for cloud sync persistence
- **Cloud backup**: Firebase Firestore (project: gen-lang-client-0184415198)
- **Supervisor**: frontend → Node.js server (bash start.sh), backend → uvicorn Python proxy

### Key Files
- `/app/server.ts` — Express server (chat, image gen, sync, TTS)
- `/app/src/screens/ImageGeneratorScreen.tsx` — 3 provider image gen UI
- `/app/src/screens/SettingsScreen.tsx` — API keys + Firebase backup UI
- `/app/src/services/firebaseService.ts` — Firestore backup/restore
- `/app/src/context/AppContext.tsx` — App state + Firebase backup functions
- `/app/.env` — All environment variables

### 2026-04-02 — Gallery Restore + Auto-Backup Schedule
- **Gallery Firebase Storage restore**: `restoreGalleryFromFirebaseStorage` reads manifest from Firestore, gets download URLs, fetches each image and converts to data URL, adds to local gallery (skips duplicates by id). Side-by-side Backup/Restore buttons with progress counters.
- **Auto-backup schedule**: `autoBackupSchedule: 'off' | 'daily' | 'weekly'` state in AppContext (IDB-persisted). `useEffect` checks every 10min if backup is due; triggers silent Firestore backup + shows push notification on completion. UI: 3-button toggle in Firebase section of Settings with "Next in: X" countdown.

### 2026-04-02 — 5 New Features
- **WaveSpeed UI clarity**: 3 reference image slots now labeled 'Character/Face', 'Pose/Style', 'Scene/BG' with per-slot hints.
- **Gallery Firebase Storage backup**: New chunked gallery upload via `uploadGalleryToFirebaseStorage` in `firebaseService.ts`. Button in Settings shows progress counter and gallery count.
- **Freepik img2img structure reference**: Custom image upload slot added to Freepik Pose Reference (any image can be used, not just persona photo). Custom image takes priority over persona photo.
- **Last backup timestamps**: `lastCloudSyncTime`, `lastFirebaseBackupTime`, `lastGalleryBackupTime` tracked in AppContext (IDB-persisted). Shown as "X ago" below each respective backup button.
- **Multi-user cloud sync isolation**: Removed secondary aiProfile.id lookup in `/api/sync/:userId`. Strictly returns data for exact userId match only (404 for unknown users).


- Fixed MongoDB URI not persisting to IDB: `setMongoUri` in AppContext now directly patches `indigo_app_data_core` via `loadFromDB/saveToDB` instead of relying on stale `saveData` closure. Also added `mongoUri` to `saveData` data object and both dependency arrays.
- Fixed Stability AI img2img: added `form.append("mode", mode)` to server.ts FormData (was computed but never sent to Stability API).
- Fixed physical appearance not prepended to Stability AI prompts: moved `enrichedPrompt` computation before the Stability block in `ImageGeneratorScreen.tsx` so all providers get appearance prepended.
- Fixed Firebase backup feedback: added pre-flight checks in `handleFirebaseBackup` (validates Firebase API key, Project ID, App ID, and User ID with descriptive error toasts before attempting backup). Added "Backup starting…" info toast.


- Added OpenRouter, Cartesia, Emergent LLM key fields in Settings → API Keys section
- Added MongoDB Configuration section with live URI update (reconnects immediately, persists to .env)
- Added `cartesiaApiKey`, `emergentLlmKey`, `mongoUri` state + setters to AppContext
- Fixed `openRouterApiKey` to actually load from saved data (was missing from load block)
- `/api/config/set-mongo` endpoint for runtime MongoDB URI changes without restart

### 2026-03-31 — Initial Setup + Integrations
- Set up the project in the Emergent environment (frontend/backend supervisor wrappers)
- Installed node_modules (yarn), firebase, mongodb packages
- Fixed Vite `allowedHosts: true` for preview domain access
- **Stability AI**: Added `/api/image/stability/generate` endpoint (Stable Image Core + SD3.5 Large/Turbo/Medium)
- **MongoDB**: Replaced JSON file sync with MongoDB persistence (auto-migrates on startup)
- **Firebase**: Implemented `firebaseService.ts` with `backupToFirestore` / `restoreFromFirestore`
- Fixed AppContext to properly load `stabilityApiKey` from IndexedDB on startup
- Added Stability AI key field in Settings + Firebase backup section
- All 9 integration tests passed (100% pass rate)

## Core Requirements (Static)
- Keep Freepik Mystic + WaveSpeed as existing image providers
- Add Stability AI (SD3.5) with minimal content restrictions
- MongoDB for persistent cloud sync backup
- Firebase Firestore for additional cloud backup layer
- No DALL-E, no Gemini image gen

## Prioritized Backlog

### P0 (Done)
- [x] App running in Emergent environment
- [x] Stability AI image generation + img2img (Apr 2026)
- [x] MongoDB sync persistence
- [x] Firebase backup/restore (full data, with MongoDB restore)
- [x] OpenRouter LLM integration (Apr 2026)
- [x] Cartesia TTS integration with speed/emotion controls (Apr 2026)
- [x] Firebase config inputs fixed (local state, batch save)
- [x] LLM max tokens slider, ElevenLabs voice quality sliders
- [x] Stability AI style presets, output format, negative prompt, img2img
- [x] MongoDB JSON export/import tool
- [x] UI toast notifications for Settings saves

### P1 (Next)
- [ ] Freepik img2img structure reference UI (backend ready, needs frontend)
- [ ] WaveSpeed reference image upload UI clarity

### P2 (Future)
- [ ] Gallery chunked backup to Firebase Storage
- [ ] Multi-user cloud sync with userId isolation
