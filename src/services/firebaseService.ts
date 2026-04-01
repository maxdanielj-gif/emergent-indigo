import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, Firestore, serverTimestamp,
} from 'firebase/firestore';

export interface FirebaseRuntimeConfig {
  apiKey?:            string | null;
  authDomain?:        string | null;
  projectId?:         string | null;
  storageBucket?:     string | null;
  messagingSenderId?: string | null;
  appId?:             string | null;
}

// ── Build config: env vars are the fallback, runtime values take priority ─────
function buildConfig(runtime?: FirebaseRuntimeConfig) {
  return {
    apiKey:            runtime?.apiKey            || import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        runtime?.authDomain        || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         runtime?.projectId         || import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     runtime?.storageBucket     || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: runtime?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             runtime?.appId             || import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function isConfigured(config: ReturnType<typeof buildConfig>): boolean {
  return !!(config.apiKey && config.projectId && config.appId);
}

// ── Get a Firestore instance using the provided config ────────────────────────
// Re-initializes Firebase if the config has changed (e.g. user updated keys in Settings)
let currentApp:  FirebaseApp | null = null;
let currentDb:   Firestore   | null = null;
let lastConfigKey = '';

function getDb(runtime?: FirebaseRuntimeConfig): Firestore {
  const config    = buildConfig(runtime);
  const configKey = JSON.stringify(config);

  if (!isConfigured(config)) {
    throw new Error(
      'Firebase is not fully configured. Fill in all Firebase keys in Settings → Firebase Configuration.'
    );
  }

  // Re-initialize only when config actually changed
  if (configKey !== lastConfigKey) {
    if (currentApp) {
      try { deleteApp(currentApp); } catch {}
    }
    currentApp     = initializeApp(config, `indigo-${Date.now()}`);
    currentDb      = getFirestore(currentApp);
    lastConfigKey  = configKey;
  }

  return currentDb!;
}

// ── Backup app data to Firestore ──────────────────────────────────────────────
export async function backupToFirestore(
  userId: string,
  data: any,
  runtime?: FirebaseRuntimeConfig,
): Promise<void> {
  if (!userId?.trim()) throw new Error("A User ID is required. Set one in Settings → Cloud Sync.");

  const db = getDb(runtime);
  const { gallery, ...safeData } = data;
  const galleryIds = Array.isArray(gallery) ? gallery.map((g: any) => g.id) : [];

  await setDoc(doc(db, 'indigo_backups', userId.trim()), {
    ...safeData,
    galleryIds,
    backedUpAt:    serverTimestamp(),
    backupVersion: 2,
  });
}

// ── Restore app data from Firestore ──────────────────────────────────────────
export async function restoreFromFirestore(
  userId: string,
  runtime?: FirebaseRuntimeConfig,
): Promise<any | null> {
  if (!userId?.trim()) throw new Error("A User ID is required. Set one in Settings → Cloud Sync.");

  const db   = getDb(runtime);
  const snap = await getDoc(doc(db, 'indigo_backups', userId.trim()));
  if (!snap.exists()) return null;
  return snap.data();
}
