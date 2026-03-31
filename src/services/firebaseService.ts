import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, Firestore, serverTimestamp,
} from 'firebase/firestore';

// ── Firebase config from env vars (set in .env / vite.config.ts) ──────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null   = null;
let db:  Firestore   | null   = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existing = getApps();
    app = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
  }
  return app;
}

function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

function isConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

// ── Backup app data to Firestore ──────────────────────────────────────────────
export async function backupToFirestore(userId: string, data: any): Promise<void> {
  if (!isConfigured()) throw new Error("Firebase is not configured. Check your VITE_FIREBASE_* environment variables.");
  if (!userId?.trim()) throw new Error("A User ID is required for Firebase backup. Set one in Settings → Cloud Sync.");

  const firestore = getDb();
  // Strip gallery (large base64 images) from backup to avoid Firestore 1MB doc limit
  const { gallery, ...safeData } = data;
  const galleryIds = Array.isArray(gallery) ? gallery.map((g: any) => g.id) : [];

  await setDoc(doc(firestore, "indigo_backups", userId.trim()), {
    ...safeData,
    galleryIds,
    backedUpAt:    serverTimestamp(),
    backupVersion: 2,
  });
}

// ── Restore app data from Firestore ──────────────────────────────────────────
export async function restoreFromFirestore(userId: string): Promise<any | null> {
  if (!isConfigured()) throw new Error("Firebase is not configured. Check your VITE_FIREBASE_* environment variables.");
  if (!userId?.trim()) throw new Error("A User ID is required. Set one in Settings → Cloud Sync.");

  const firestore = getDb();
  const snap = await getDoc(doc(firestore, "indigo_backups", userId.trim()));
  if (!snap.exists()) return null;
  return snap.data();
}

export { isConfigured };
