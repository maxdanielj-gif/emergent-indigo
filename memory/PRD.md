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

### 2026-04-01 — Settings key fields + MongoDB override
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
- [x] Stability AI image generation
- [x] MongoDB sync persistence
- [x] Firebase backup/restore
- [x] OpenRouter LLM integration (Apr 2026)
- [x] Cartesia TTS integration (Apr 2026)

### P1 (Next)
- [ ] Full Firebase restore (import backed-up data into app state)
- [ ] Gallery images chunked backup to Firebase Storage
- [ ] Stability AI img2img (image-to-image) support

### P2 (Future)
- [ ] Stability AI video generation (Stable Video Diffusion)
- [ ] MongoDB backup export/import tool
- [ ] Multi-user cloud sync with userId isolation
- [ ] UI toast notifications for Settings key saves
