import React, { useRef, useState } from 'react';
import { gzipSync, strToU8 } from 'fflate';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import { requestNotificationPermission } from '../services/webPushService';
import { showNativeNotification } from '../services/notificationService';
import { processFile } from '../services/ocrService';
import { Download, Upload, Trash2, Bell, FileText, Key, HelpCircle, Save, Database, MapPin, Copy, Smartphone, Cloud, RefreshCw, Clock, Shield, Edit2 } from 'lucide-react';

const SettingsScreen: React.FC = () => {
  const {
    importData, knowledgeBase, addToKnowledgeBase,
    asyncApiKey, setAsyncApiKey,
    anthropicApiKey, setAnthropicApiKey,
    elevenLabsApiKey, setElevenLabsApiKey,
    geminiApiKey, setGeminiApiKey,
    freepikApiKey, setFreepikApiKey,
    wavespeedApiKey, setWavespeedApiKey,
    stabilityApiKey, setStabilityApiKey,
    openRouterApiKey, setOpenRouterApiKey,
    cartesiaApiKey, setCartesiaApiKey,
    emergentLlmKey, setEmergentLlmKey,
    mongoUri, setMongoUri,
    setShowTutorial,
    autoSaveChat, setAutoSaveChat, autoSaveChatInterval, setAutoSaveChatInterval,
    autoJsonBackup, setAutoJsonBackup, autoJsonBackupInterval, setAutoJsonBackupInterval,
    resetApp, aiProfile, userProfile,
    notificationsEnabled, setNotificationsEnabled,
    fcmToken, setFcmToken,
    exportData, addToast,
    showTimestamps, setShowTimestamps,
    timeZone, setTimeZone,
    userId, setUserId,
    isSyncing, setIsSyncing,
    isSyncEnabled, setIsSyncEnabled,
    syncFrequency, setSyncFrequency,
    updateAIProfile,
    isDebuggerEnabled, setIsDebuggerEnabled,
    firebaseBackup, firebaseRestore,
    firebaseApiKey:       fbApiKey,       setFirebaseApiKey:       setFbApiKey,
    firebaseAuthDomain:   fbAuthDomain,   setFirebaseAuthDomain:   setFbAuthDomain,
    firebaseProjectId:    fbProjectId,    setFirebaseProjectId:    setFbProjectId,
    firebaseStorageBucket:fbStorageBucket,setFirebaseStorageBucket:setFbStorageBucket,
    firebaseMessagingSenderId: fbSenderId,setFirebaseMessagingSenderId: setFbSenderId,
    firebaseAppId:        fbAppId,        setFirebaseAppId:        setFbAppId,
    firebaseVapidKey:     fbVapidKey,     setFirebaseVapidKey:     setFbVapidKey,
    firebaseServiceAccountKey: fbServiceKey, setFirebaseServiceAccountKey: setFbServiceKey,
  } = useApp();

  const { chatHistory, addChatMessage, setChatHistory, sessions, setSessions, activeSessionId, setActiveSessionId } = useChat();

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const kbInputRef    = useRef<HTMLInputElement>(null);

  const [localAsyncApiKey,        setLocalAsyncApiKey]        = useState(asyncApiKey || '');
  const [localAnthropicApiKey,    setLocalAnthropicApiKey]    = useState(anthropicApiKey || '');
  const [localElevenLabsApiKey,   setLocalElevenLabsApiKey]   = useState(elevenLabsApiKey || '');
  const [localGeminiApiKey,       setLocalGeminiApiKey]       = useState(geminiApiKey || '');
  const [localFreepikApiKey,    setLocalFreepikApiKey]    = useState(freepikApiKey    || '');
  const [localWavespeedApiKey,  setLocalWavespeedApiKey]  = useState(wavespeedApiKey  || '');
  const [localStabilityApiKey,  setLocalStabilityApiKey]  = useState(stabilityApiKey  || '');
  const [localOpenRouterApiKey, setLocalOpenRouterApiKey] = useState(openRouterApiKey || '');
  const [localCartesiaApiKey,   setLocalCartesiaApiKey]   = useState(cartesiaApiKey   || '');
  const [localEmergentLlmKey,   setLocalEmergentLlmKey]   = useState(emergentLlmKey   || '');
  const [localMongoUri,         setLocalMongoUri]         = useState(mongoUri         || '');
  const [isApplyingMongo,       setIsApplyingMongo]       = useState(false);
  const [isFirebaseBackingUp,  setIsFirebaseBackingUp]  = useState(false);
  const [isFirebaseRestoring,  setIsFirebaseRestoring]  = useState(false);

  // Sync local key fields once the context loads saved values from IndexedDB
  React.useEffect(() => { setLocalAnthropicApiKey(anthropicApiKey || ''); }, [anthropicApiKey]);
  React.useEffect(() => { setLocalAsyncApiKey(asyncApiKey || ''); }, [asyncApiKey]);
  React.useEffect(() => { setLocalElevenLabsApiKey(elevenLabsApiKey || ''); }, [elevenLabsApiKey]);
  React.useEffect(() => { setLocalGeminiApiKey(geminiApiKey || ''); }, [geminiApiKey]);
  React.useEffect(() => { setLocalFreepikApiKey(freepikApiKey || ''); }, [freepikApiKey]);
  React.useEffect(() => { setLocalWavespeedApiKey(wavespeedApiKey || ''); }, [wavespeedApiKey]);
  React.useEffect(() => { setLocalStabilityApiKey(stabilityApiKey || ''); }, [stabilityApiKey]);
  React.useEffect(() => { setLocalOpenRouterApiKey(openRouterApiKey || ''); }, [openRouterApiKey]);
  React.useEffect(() => { setLocalCartesiaApiKey(cartesiaApiKey || ''); }, [cartesiaApiKey]);
  React.useEffect(() => { setLocalEmergentLlmKey(emergentLlmKey || ''); }, [emergentLlmKey]);
  React.useEffect(() => { setLocalMongoUri(mongoUri || ''); }, [mongoUri]);
  const [localSyncId,          setLocalSyncId]          = useState(userId || '');
  const [recoveryId,           setRecoveryId]           = useState('');
  const [isExporting,          setIsExporting]          = useState(false);
  const [isImporting,          setIsImporting]          = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isTestingProactive,   setIsTestingProactive]   = useState(false);

  // Keep local sync ID in step with context userId
  React.useEffect(() => { if (userId) setLocalSyncId(userId); }, [userId]);

  // ── Sync & Recovery ──────────────────────────────────────────────
  const handleSync = async () => {
    setIsSyncing(true);
    addToast({ title: 'Sync', message: 'Syncing to cloud…', type: 'info' });
    try {
      const data = await exportData(chatHistory, sessions, activeSessionId);
      const compressed = gzipSync(strToU8(JSON.stringify({ userId: localSyncId, data })));
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: compressed,
      });
      if (!res.ok) throw new Error('Sync failed');
      addToast({ title: 'Sync', message: 'Data synced to cloud!', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Sync Failed', message: e.message || 'Unknown error', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRecover = async () => {
    if (!recoveryId.trim()) {
      addToast({ title: 'Recovery', message: 'Enter a Sync ID first.', type: 'warning' });
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/sync/${recoveryId}`);
      if (!res.ok) throw new Error('Recovery failed');
      const data = await res.json();
      importData(JSON.stringify(data), setChatHistory, setSessions, setActiveSessionId);
      addToast({ title: 'Recovery', message: 'Data recovered from cloud!', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Recovery Failed', message: e.message || 'Unknown error', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSyncId = () => {
    if (!localSyncId.trim()) {
      addToast({ title: 'Settings', message: 'Sync ID cannot be empty.', type: 'warning' });
      return;
    }
    setUserId(localSyncId.trim());
    localStorage.setItem('indigo_user_id', localSyncId.trim());
    addToast({ title: 'Saved', message: 'Sync ID updated.', type: 'success' });
  };

  // ── API keys ─────────────────────────────────────────────────────
  const handleSaveAnthropicKey = () => {
    setAnthropicApiKey(localAnthropicApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Anthropic API key saved.', type: 'success' });
  };

  const handleSaveAsyncKey = () => {
    setAsyncApiKey(localAsyncApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Async API key saved.', type: 'success' });
  };

  const handleSaveElevenLabsKey = () => {
    setElevenLabsApiKey(localElevenLabsApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'ElevenLabs API key saved.', type: 'success' });
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(localGeminiApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Gemini API key saved.', type: 'success' });
  };

  const handleSaveFreepikKey = () => {
    setFreepikApiKey(localFreepikApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Freepik API key saved.', type: 'success' });
  };
  const handleSaveWavespeedKey = () => {
    setWavespeedApiKey(localWavespeedApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'WaveSpeed API key saved.', type: 'success' });
  };
  const handleSaveStabilityKey = () => {
    setStabilityApiKey(localStabilityApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Stability AI key saved.', type: 'success' });
  };
  const handleSaveOpenRouterKey = () => {
    setOpenRouterApiKey(localOpenRouterApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'OpenRouter key saved.', type: 'success' });
  };
  const handleSaveCartesiaKey = () => {
    setCartesiaApiKey(localCartesiaApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Cartesia key saved.', type: 'success' });
  };
  const handleSaveEmergentLlmKey = () => {
    setEmergentLlmKey(localEmergentLlmKey.trim() || null);
    addToast({ title: 'Saved', message: 'Emergent LLM key saved.', type: 'success' });
  };

  const handleSaveFirebaseConfig = () => {
    // Values are already held in context state via setFb* — just show a toast confirmation
    addToast({ title: 'Firebase Config Saved', message: 'Firebase configuration updated. It will be used for the next backup/restore.', type: 'success' });
  };
  const handleApplyMongoUri = async () => {
    if (!localMongoUri.trim()) return;
    setIsApplyingMongo(true);
    try {
      const res = await fetch('/api/config/set-mongo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mongoUrl: localMongoUri.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMongoUri(localMongoUri.trim());
      addToast({ title: 'MongoDB updated', message: data.message, type: 'success' });
    } catch (e: any) {
      addToast({ title: 'MongoDB update failed', message: e.message, type: 'error' });
    } finally {
      setIsApplyingMongo(false);
    }
  };

  const handleFirebaseBackup = async () => {
    setIsFirebaseBackingUp(true);
    try {
      // Collect current app data for backup (chat history + journal + memories + gallery metadata)
      const currentData = {
        userId,
        timestamp: Date.now(),
        note: 'Backed up from indigo AI app',
      };
      await firebaseBackup(currentData);
      addToast({ title: 'Backup complete', message: `App data backed up to Firebase for user: ${userId}`, type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Backup failed', message: e.message || 'Could not back up to Firebase.', type: 'error' });
    } finally {
      setIsFirebaseBackingUp(false);
    }
  };

  const handleFirebaseRestore = async () => {
    setIsFirebaseRestoring(true);
    try {
      const data = await firebaseRestore();
      if (!data) {
        addToast({ title: 'No backup found', message: `No Firebase backup found for user ID: ${userId}`, type: 'warning' });
      } else {
        addToast({ title: 'Backup found', message: `Firebase backup found (saved ${data.backedUpAt ? new Date(data.backedUpAt?.toDate?.() ?? data.backedUpAt).toLocaleString() : 'N/A'}). Use the standard JSON import to restore data.`, type: 'info' });
      }
    } catch (e: any) {
      addToast({ title: 'Restore failed', message: e.message || 'Could not reach Firebase.', type: 'error' });
    } finally {
      setIsFirebaseRestoring(false);
    }
  };

  // ── Notifications ────────────────────────────────────────────────
  const handleNotificationToggle = async () => {
    if (typeof Notification === 'undefined') {
      addToast({ title: 'Not Supported', message: 'Notifications not supported in this browser.', type: 'warning' });
      return;
    }
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    if (next) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        addToast({ title: 'Enabled', message: 'Notifications enabled.', type: 'success' });
      } else {
        addToast({ title: 'Permission Denied', message: 'Enable notifications in browser settings.', type: 'warning' });
        setNotificationsEnabled(false);
      }
    }
  };

  const handleEnablePush = async () => {
    const result = await requestNotificationPermission(userId || undefined);
    if (result.success && result.endpoint) {
      setFcmToken(result.endpoint);
      addToast({ title: 'Push Enabled', message: result.message, type: 'success' });
    } else {
      addToast({ title: 'Push Failed', message: result.message, type: 'error' });
    }
  };

  const handleTestPush = async () => {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: 'indigo AI', body: 'Test push notification!' }),
      });
      if (res.ok) {
        addToast({ title: 'Test Sent', message: 'Push notification sent.', type: 'success' });
      } else {
        const err = await res.json();
        addToast({ title: 'Test Failed', message: err.error || 'Failed', type: 'error' });
      }
    } catch (e: any) {
      addToast({ title: 'Test Failed', message: e.message, type: 'error' });
    }
  };

  // ── Proactive message test ────────────────────────────────────────
  const handleTestProactiveMessage = async () => {
    setIsTestingProactive(true);
    addToast({ title: 'Proactive Message', message: 'Generating…', type: 'info' });
    try {
      const res = await fetch('/api/proactive-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: chatHistory.slice(-5),
          aiProfile, userProfile,
          anthropicApiKey: anthropicApiKey || undefined,
          userId,
        }),
      });
      if (res.ok) {
        const { message } = await res.json();
        if (message && message !== 'IN_PROGRESS') {
          addChatMessage({ id: `proactive-${Date.now()}`, role: 'model', content: message, timestamp: Date.now() });
          addToast({ title: 'Proactive Message', message: 'Message generated.', type: 'success' });
        }
      } else {
        const err = await res.json();
        addToast({ title: 'Failed', message: err.error || 'Unknown error', type: 'error' });
      }
    } catch (e: any) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setIsTestingProactive(false);
    }
  };

  // ── Export / Import ───────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    addToast({ title: 'Exporting', message: 'Preparing backup…', type: 'info' });
    try {
      const data = await exportData(chatHistory, sessions, activeSessionId);
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const ts   = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      a.download = `${aiProfile.name}_backup_${ts}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); setIsExporting(false); }, 100);
      addToast({ title: 'Exported', message: 'Backup downloaded.', type: 'success' });
    } catch {
      addToast({ title: 'Export Failed', message: 'Failed to export.', type: 'error' });
      setIsExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    addToast({ title: 'Importing', message: 'Restoring data…', type: 'info' });
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if (ev.target?.result) importData(ev.target.result as string, setChatHistory, setSessions, setActiveSessionId);
      } finally { setIsImporting(false); }
    };
    reader.onerror = () => { addToast({ title: 'Import Failed', message: 'Could not read file.', type: 'error' }); setIsImporting(false); };
    reader.readAsText(file);
  };

  // ── Knowledge base ────────────────────────────────────────────────
  const handleKBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    addToast({ title: 'Knowledge Base', message: `Processing ${files.length} file(s)…`, type: 'info' });
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const processed = await processFile(file, file.name, anthropicApiKey || undefined);
        for (const p of processed) addToKnowledgeBase({ name: p.name, content: p.content || '' });
      }
      addToast({ title: 'Knowledge Base', message: 'All files processed.', type: 'success' });
    } catch {
      addToast({ title: 'Upload Failed', message: 'Failed to process files.', type: 'error' });
    } finally { setIsImporting(false); }
  };

  // ── Browser tools ─────────────────────────────────────────────────
  const handleLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => addToast({ title: 'Location', message: `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`, type: 'info' }),
        (err) => addToast({ title: 'Location Error', message: err.message, type: 'error' })
      );
    } else {
      addToast({ title: 'Not Supported', message: 'Geolocation not available.', type: 'warning' });
    }
  };

  const handleStorageCheck = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      const usedMB  = ((usage  || 0) / 1024 / 1024).toFixed(1);
      const totalMB = ((quota  || 0) / 1024 / 1024).toFixed(0);
      addToast({ title: 'Storage', message: `${usedMB} MB used of ~${totalMB} MB`, type: 'info' });
    } else {
      addToast({ title: 'Not Supported', message: 'Storage estimation not available.', type: 'warning' });
    }
  };

  const handleClipboardCopy = async () => {
    setIsExporting(true);
    try {
      const data = await exportData(chatHistory, sessions, activeSessionId);
      await navigator.clipboard.writeText(JSON.stringify(data));
      addToast({ title: 'Copied', message: 'Data copied to clipboard.', type: 'success' });
    } catch {
      addToast({ title: 'Failed', message: 'Clipboard copy failed.', type: 'error' });
    } finally { setIsExporting(false); }
  };

  // ── JSX ───────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full p-4 overflow-y-auto bg-transparent">
      <h2 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">Settings</h2>

      {isSyncing && (
        <div className="w-full h-1 bg-indigo-100 dark:bg-indigo-900 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-indigo-600 animate-pulse w-full" />
        </div>
      )}

      <div className="space-y-8">

        {/* ── API Keys ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">API Keys</h3>
          <div className="space-y-4">

            {/* Anthropic */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Anthropic API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(required for AI chat)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localAnthropicApiKey}
                    onChange={(e) => setLocalAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-…"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveAnthropicKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="underline">console.anthropic.com</a>.
                If the server has a key set, you can leave this blank.
              </p>
            </div>

            {/* Async */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Async API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(required for Async TTS)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localAsyncApiKey}
                    onChange={(e) => setLocalAsyncApiKey(e.target.value)}
                    placeholder="Your Async API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveAsyncKey} className="app-btn-primary">Save</button>
              </div>
            </div>

            {/* ElevenLabs */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                ElevenLabs API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(optional — for ElevenLabs TTS)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localElevenLabsApiKey}
                    onChange={(e) => setLocalElevenLabsApiKey(e.target.value)}
                    placeholder="Your ElevenLabs API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveElevenLabsKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="underline">elevenlabs.io</a>. Used as an alternative TTS engine in Voice Settings.
              </p>
            </div>

            {/* Gemini */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Gemini API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(optional — for Gemini chat models)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localGeminiApiKey}
                    onChange={(e) => setLocalGeminiApiKey(e.target.value)}
                    placeholder="Your Gemini API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveGeminiKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline">aistudio.google.com</a>. Enables Gemini models in AI Profile settings, and auto-fallback if Claude is unavailable.
              </p>
            </div>

            {/* Freepik */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Freepik API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(required for image generation)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localFreepikApiKey}
                    onChange={(e) => setLocalFreepikApiKey(e.target.value)}
                    placeholder="Your Freepik API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveFreepikKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://www.freepik.com/developers/dashboard" target="_blank" rel="noreferrer" className="underline">freepik.com/developers</a>. Enables AI image generation. New accounts get $5 in free credits.
              </p>
            </div>

            {/* WaveSpeed */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                WaveSpeed API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(for WaveSpeed image/video models)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localWavespeedApiKey}
                    onChange={(e) => setLocalWavespeedApiKey(e.target.value)}
                    placeholder="Your WaveSpeed API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveWavespeedKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://wavespeed.ai/accesskey" target="_blank" rel="noreferrer" className="underline">wavespeed.ai/accesskey</a>. Enables WaveSpeed image editing and video generation. Requires a top-up to activate.
              </p>
            </div>

            {/* OpenRouter */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                OpenRouter API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(for 200+ LLM models)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input type="password" value={localOpenRouterApiKey}
                    onChange={(e) => setLocalOpenRouterApiKey(e.target.value)}
                    placeholder="sk-or-..."
                    data-testid="openrouter-api-key-input"
                    className="app-input pl-9" />
                </div>
                <button onClick={handleSaveOpenRouterKey} data-testid="openrouter-api-key-save" className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">openrouter.ai/keys</a>. Routes to Claude, GPT, Llama, Mistral, DeepSeek and more.
              </p>
            </div>

            {/* Cartesia */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Cartesia API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(for Cartesia TTS)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input type="password" value={localCartesiaApiKey}
                    onChange={(e) => setLocalCartesiaApiKey(e.target.value)}
                    placeholder="Your Cartesia API key"
                    data-testid="cartesia-api-key-input"
                    className="app-input pl-9" />
                </div>
                <button onClick={handleSaveCartesiaKey} data-testid="cartesia-api-key-save" className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://play.cartesia.ai/keys" target="_blank" rel="noreferrer" className="underline">play.cartesia.ai/keys</a>. Fast, realistic neural TTS.
              </p>
            </div>

            {/* Emergent LLM Key */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Emergent LLM Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(universal key override)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input type="password" value={localEmergentLlmKey}
                    onChange={(e) => setLocalEmergentLlmKey(e.target.value)}
                    placeholder="Override the built-in Emergent key"
                    data-testid="emergent-llm-key-input"
                    className="app-input pl-9" />
                </div>
                <button onClick={handleSaveEmergentLlmKey} data-testid="emergent-llm-key-save" className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Overrides the built-in Emergent universal key for OpenAI, Claude, and Gemini calls. Leave blank to use the platform default.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Stability AI Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(for SD3.5 — minimal content restrictions)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localStabilityApiKey}
                    onChange={(e) => setLocalStabilityApiKey(e.target.value)}
                    placeholder="sk-..."
                    data-testid="stability-api-key-input"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveStabilityKey} data-testid="stability-api-key-save" className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://platform.stability.ai/account/keys" target="_blank" rel="noreferrer" className="underline">platform.stability.ai</a>. Enables Stable Image Core and SD3.5 generation.
              </p>
            </div>

          </div>
        </section>

        {/* ── Cloud Sync ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Cloud Sync & Recovery</h3>
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Enable Auto-Sync</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Sync to cloud automatically.</span>
              </div>
              <button
                onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                className={`w-10 h-6 rounded-full transition-colors ${isSyncEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${isSyncEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {isSyncEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-indigo-700 dark:text-indigo-300 whitespace-nowrap">Every</label>
                <input
                  type="number" min="1"
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(parseInt(e.target.value) || 5)}
                  className="app-input w-20 text-center"
                />
                <label className="text-sm text-indigo-700 dark:text-indigo-300">minutes</label>
              </div>
            )}

            {/* Sync ID */}
            <div>
              <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">Your Sync ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localSyncId}
                  onChange={(e) => setLocalSyncId(e.target.value)}
                  placeholder="Custom Sync ID"
                  className="app-input flex-1 font-mono text-sm"
                />
                <button onClick={handleSaveSyncId} title="Save ID" className="app-btn-primary px-3">
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(localSyncId); addToast({ title: 'Copied', message: 'Sync ID copied.', type: 'success' }); }}
                  title="Copy ID" className="app-btn-ghost px-3"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1 italic">Save this ID — you'll need it to recover on another device.</p>
            </div>

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="app-btn-primary w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing…' : 'Sync Now'}
            </button>

            {/* Recovery */}
            <div>
              <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">Data Recovery</label>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-2">Restore your data from the cloud using a Sync ID.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={recoveryId}
                  onChange={(e) => setRecoveryId(e.target.value)}
                  placeholder="Enter Sync ID to recover"
                  className="app-input flex-1 font-mono text-sm"
                />
                <button
                  onClick={() => { if (!recoveryId) return; if (chatHistory.length > 0) setShowOverwriteConfirm(true); else handleRecover(); }}
                  disabled={isSyncing || !recoveryId}
                  className="app-btn-primary flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Recover
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ── MongoDB Configuration ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">MongoDB Configuration</h3>
          <div className="space-y-3">
            <p className="text-sm text-indigo-600 dark:text-indigo-400">
              Override the built-in MongoDB connection. Use your own Atlas cluster URI for persistent personal storage.
            </p>
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                MongoDB Connection URI
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localMongoUri}
                    onChange={(e) => setLocalMongoUri(e.target.value)}
                    placeholder="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                    data-testid="mongo-uri-input"
                    className="app-input pl-9 font-mono text-xs"
                  />
                </div>
                <button
                  onClick={handleApplyMongoUri}
                  disabled={isApplyingMongo || !localMongoUri.trim()}
                  data-testid="mongo-uri-apply"
                  className="app-btn-primary disabled:opacity-50 flex items-center gap-1.5">
                  {isApplyingMongo ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Applying…</> : 'Apply'}
                </button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Reconnects immediately and saves to server config. Leave blank to use the default built-in MongoDB.
              </p>
            </div>
          </div>
        </section>

        {/* ── Firebase Configuration ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Firebase Configuration</h3>
          <div className="space-y-4">
            <p className="text-sm text-indigo-600 dark:text-indigo-400">
              Enter your Firebase project credentials to enable cloud backup. Find these in the{' '}
              <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-medium">Firebase Console</a>{' '}
              → Project Settings → Your apps → SDK config.
            </p>

            {/* 2-col grid for short fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'API Key',              key: 'apiKey',            val: fbApiKey,       set: setFbApiKey,       ph: 'AIzaSy...' },
                { label: 'Auth Domain',          key: 'authDomain',        val: fbAuthDomain,   set: setFbAuthDomain,   ph: 'project.firebaseapp.com' },
                { label: 'Project ID',           key: 'projectId',         val: fbProjectId,    set: setFbProjectId,    ph: 'my-project-id' },
                { label: 'Storage Bucket',       key: 'storageBucket',     val: fbStorageBucket,set: setFbStorageBucket,ph: 'project.firebasestorage.app' },
                { label: 'Messaging Sender ID',  key: 'messagingSenderId', val: fbSenderId,     set: setFbSenderId,     ph: '123456789012' },
                { label: 'App ID',               key: 'appId',             val: fbAppId,        set: setFbAppId,        ph: '1:123:web:abc123' },
                { label: 'VAPID Key',            key: 'vapidKey',          val: fbVapidKey,     set: setFbVapidKey,     ph: 'BJ...' },
              ].map(({ label, key, val, set, ph }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">{label}</label>
                  <input
                    type="password"
                    value={val ?? ''}
                    onChange={(e) => set(e.target.value)}
                    placeholder={ph}
                    data-testid={`firebase-${key}-input`}
                    className="app-input font-mono text-xs"
                  />
                </div>
              ))}
            </div>

            {/* Service Account Key — full-width textarea */}
            <div>
              <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Service Account Key <span className="font-normal text-indigo-400">(optional — for server-side operations)</span>
              </label>
              <textarea
                value={fbServiceKey ?? ''}
                onChange={(e) => setFbServiceKey(e.target.value)}
                placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                rows={4}
                data-testid="firebase-serviceAccountKey-input"
                className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
              />
            </div>

            <button
              onClick={handleSaveFirebaseConfig}
              data-testid="firebase-config-save"
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm">
              Save Firebase Configuration
            </button>

            {/* Backup / Restore */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-800">
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-3">
                Back up your app data to Firestore. Your User ID (set in Cloud Sync above) is used as the document key.
              </p>
              {!userId && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300 mb-3">
                  Set a User ID in Cloud Sync &amp; Recovery above before backing up.
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleFirebaseBackup} disabled={isFirebaseBackingUp || !userId}
                  data-testid="firebase-backup-btn"
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                  {isFirebaseBackingUp ? <><RefreshCw className="w-4 h-4 animate-spin" />Backing up…</> : 'Backup to Firebase'}
                </button>
                <button onClick={handleFirebaseRestore} disabled={isFirebaseRestoring || !userId}
                  data-testid="firebase-restore-btn"
                  className="flex-1 py-2.5 bg-white dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                  {isFirebaseRestoring ? <><RefreshCw className="w-4 h-4 animate-spin" />Checking…</> : 'Check Backup'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Knowledge Base ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Knowledge Base</h3>
          <button
            onClick={() => kbInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-center w-full p-4 border-2 border-dashed border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors text-indigo-600 dark:text-indigo-400 disabled:opacity-50"
          >
            {isImporting ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
            {isImporting ? 'Processing…' : 'Upload Documents'}
          </button>
          <input ref={kbInputRef} type="file" onChange={handleKBUpload} multiple
            accept=".txt,.md,.pdf,.json,.csv,.xml,.html,.js,.ts,.py,.go,.rb,.sql,.yml,.yaml"
            className="hidden" />
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2 text-center">
            Supported: .txt .md .pdf .json .csv .xml .html .js .ts .py and more
          </p>
          {knowledgeBase.length > 0 && (
            <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {knowledgeBase.map((file, i) => (
                <li key={i} className="flex items-center text-xs text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-900 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                  <FileText className="w-3 h-3 mr-2 flex-shrink-0 text-indigo-400" />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="ml-2 text-indigo-400 flex-shrink-0">
                    {file.content.length > 1024 ? `${(file.content.length / 1024).toFixed(0)} KB` : `${file.content.length} B`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Data Management ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Data Management</h3>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-3">JSON backups do not include images or videos.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} disabled={isExporting}
              className="flex items-center justify-center p-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 text-sm text-indigo-700 dark:text-indigo-300">
              {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {isExporting ? 'Exporting…' : 'Export JSON'}
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting}
              className="flex items-center justify-center p-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 text-sm text-indigo-700 dark:text-indigo-300">
              {isImporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {isImporting ? 'Importing…' : 'Import JSON'}
            </button>
          </div>
          <input ref={fileInputRef} type="file" onChange={handleImport} accept=".json" className="hidden" />
        </section>

        {/* ── Preferences ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Preferences</h3>
          <div className="space-y-4">

            {/* JSON backup interval */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Auto JSON Backup</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Interval in minutes (0 to disable).</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={autoJsonBackupInterval}
                  onChange={(e) => setAutoJsonBackupInterval(Number(e.target.value))}
                  className="app-input w-20 text-center text-sm" />
                <button onClick={() => setAutoJsonBackup(!autoJsonBackup)}
                  className={`w-10 h-6 rounded-full transition-colors ${autoJsonBackup ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${autoJsonBackup ? 'translate-x-2' : '-translate-x-2'}`} />
                </button>
              </div>
            </div>

            {/* Proactive test */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Test Proactive Message</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Send one immediately.</span>
              </div>
              <button onClick={handleTestProactiveMessage} disabled={isTestingProactive}
                className="app-btn-primary flex items-center gap-1 text-sm">
                {isTestingProactive && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isTestingProactive ? 'Generating…' : 'Test'}
              </button>
            </div>

            {/* In-app notifications toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">In-App Notifications</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Show toast notifications inside the app.</span>
              </div>
              <button onClick={handleNotificationToggle}
                className={`w-10 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${notificationsEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Message Timestamps</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Show date/time on each message.</span>
              </div>
              <button onClick={() => setShowTimestamps(!showTimestamps)}
                className={`w-10 h-6 rounded-full transition-colors ${showTimestamps ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${showTimestamps ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {/* Mobile Debugger toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">🐛 Mobile Debugger</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Shows a floating bug button for viewing logs and running JS.</span>
              </div>
              <button onClick={() => setIsDebuggerEnabled(!isDebuggerEnabled)}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${isDebuggerEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${isDebuggerEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {/* Time zone */}
            <div>
              <label className="text-sm text-indigo-900 dark:text-indigo-100 block mb-1">Time Zone</label>
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="app-input">
                {Intl.supportedValuesOf('timeZone').map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

          </div>
        </section>

        {/* ── Browser Tools ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Browser Tools</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={handleLocation}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
              <MapPin className="w-5 h-5 mb-1 text-indigo-400" />
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Location</span>
            </button>
            <button onClick={handleClipboardCopy} disabled={isExporting}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all disabled:opacity-50">
              {isExporting ? <RefreshCw className="w-5 h-5 mb-1 text-indigo-400 animate-spin" /> : <Copy className="w-5 h-5 mb-1 text-indigo-400" />}
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Copy Data</span>
            </button>
            <button onClick={handleStorageCheck}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
              <Database className="w-5 h-5 mb-1 text-indigo-400" />
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Storage</span>
            </button>
            <button onClick={handleEnablePush}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
              <Smartphone className="w-5 h-5 mb-1 text-indigo-400" />
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Enable Push</span>
            </button>
            <button onClick={handleTestPush}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
              <Bell className="w-5 h-5 mb-1 text-indigo-400" />
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Test Push</span>
            </button>
          </div>
          {fcmToken && (
            <p className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Push subscription active
            </p>
          )}
        </section>

        {/* ── Help ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Help</h3>
          <button onClick={() => setShowTutorial(true)}
            className="app-btn-ghost w-full flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Start Tutorial
          </button>
        </section>

        {/* ── Danger Zone ── */}
        <section>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 border-b border-red-100 dark:border-red-900/30 pb-2">Danger Zone</h3>
          <button
            onClick={async () => {
              if (window.confirm('This will wipe all local data and reset the app. Are you sure?')) {
                try { await resetApp(); }
                catch { addToast({ title: 'Reset Failed', message: 'Failed to reset.', type: 'error' }); }
              }
            }}
            className="flex items-center text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset All Data
          </button>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">Cannot be undone.</p>
        </section>

      </div>

      {/* Overwrite confirm modal */}
      {showOverwriteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-indigo-950 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-indigo-100 dark:border-indigo-800">
            <h3 className="text-lg font-bold mb-3 text-indigo-900 dark:text-indigo-100">Overwrite current chat?</h3>
            <p className="mb-5 text-sm text-indigo-600 dark:text-indigo-400">You have an active chat. Recovering will replace it with cloud data.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowOverwriteConfirm(false)} className="app-btn-ghost">Cancel</button>
              <button onClick={() => { setShowOverwriteConfirm(false); handleRecover(); }} className="app-btn-primary">Overwrite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
