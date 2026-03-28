import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download, RefreshCw, Image as ImageIcon, User, X,
  ChevronDown, ChevronUp, Plus, Trash2, Wand2, Palette,
  CheckCircle, Clock, AlertCircle, Upload
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

// Engine choices
const ENGINES = [
  { label: 'Mystic — Ultra-realistic, LoRA support', value: 'mystic' },
  { label: 'Flux 2 Klein — Fast, best character consistency', value: 'klein' },
] as const;
type Engine = 'mystic' | 'klein';

// Mystic aspect ratios
const ASPECT_RATIOS_MYSTIC = [
  { label: 'Square (1:1)',      value: 'square_1_1'      },
  { label: 'Portrait (3:4)',    value: 'traditional_3_4' },
  { label: 'Landscape (4:3)',   value: 'classic_4_3'     },
  { label: 'Tall (9:16)',       value: 'social_story_9_16'},
  { label: 'Wide (16:9)',       value: 'widescreen_16_9' },
];
// Klein supports more ratios
const ASPECT_RATIOS_KLEIN = [
  { label: 'Square (1:1)',      value: 'square_1_1'      },
  { label: 'Portrait (2:3)',    value: 'portrait_2_3'    },
  { label: 'Portrait (3:4)',    value: 'traditional_3_4' },
  { label: 'Landscape (4:3)',   value: 'classic_4_3'     },
  { label: 'Landscape (3:2)',   value: 'standard_3_2'    },
  { label: 'Tall (9:16)',       value: 'social_story_9_16'},
  { label: 'Wide (16:9)',       value: 'widescreen_16_9' },
  { label: 'Social (4:5)',      value: 'social_post_4_5' },
];

const RESOLUTIONS = [
  { label: '1K — Fast',     value: '1k' },
  { label: '2K — High res', value: '2k' },
  { label: '4K — Mystic only', value: '4k' },
];
const MODELS = [
  { label: 'Realism (photorealistic)', value: 'realism' },
  { label: 'Anime',                    value: 'anime'   },
  { label: '2.5D',                     value: '2_5d'    },
];
const TABS = ['Generate', 'Style Transfer', 'Character LoRA'] as const;
type Tab = typeof TABS[number];
type JobStatus = 'idle' | 'creating' | 'waiting' | 'succeeded' | 'failed';

// ── Slider component ─────────────────────────────────────────────────────────

function Slider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{label}</span>
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{value}</span>
      </div>
      <div className="relative w-full h-6 flex items-center">
        <div className="absolute w-full h-2 bg-indigo-200 dark:bg-indigo-700 rounded-full" />
        <div className="absolute h-2 bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-6" />
        <div className="absolute w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 10px)` }} />
      </div>
    </div>
  );
}

// ── Image picker helper ───────────────────────────────────────────────────────

function ImagePickerButton({ label, value, onChange }: {
  label: string; value: string | null; onChange: (b64: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">{label}</p>
      <div className="flex gap-2 items-center">
        {value ? (
          <>
            <img src={value} alt="" className="w-12 h-12 rounded-lg object-cover border border-indigo-300 dark:border-indigo-700" />
            <button onClick={() => onChange(null)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X className="w-3 h-3" /> Remove
            </button>
          </>
        ) : (
          <button onClick={() => ref.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-dashed border-indigo-400 dark:border-indigo-600 rounded-xl text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
            <Upload className="w-3 h-3" /> Upload image
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result as string);
            reader.readAsDataURL(f);
            e.target.value = '';
          }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ImageGeneratorScreen: React.FC = () => {
  const { freepikApiKey, aiProfile, addToGallery, addToast } = useApp();
  const hasRef = !!aiProfile.referenceImage;

  const [activeTab, setActiveTab] = useState<Tab>('Generate');

  // ── Generate tab state ────────────────────────────────────────────────────
  const [engine,            setEngine]            = useState<Engine>('mystic');
  const [useReference,      setUseReference]      = useState(hasRef);
  const [styleRefImage,     setStyleRefImage]      = useState<string | null>(null);
  const [prompt,            setPrompt]            = useState('');
  const [negPrompt,         setNegPrompt]         = useState('');
  const [aspectRatio,       setAspectRatio]       = useState('square_1_1');
  const [resolution,        setResolution]        = useState('2k');
  const [model,             setModel]             = useState('realism');
  const [structureStrength, setStructureStrength] = useState(35);
  const [adherence,         setAdherence]         = useState(50);
  const [hdr,               setHdr]               = useState(50);
  const [creativeDetailing, setCreativeDetailing] = useState(33);
  const [showAdvanced,      setShowAdvanced]      = useState(false);
  const [selectedLoraChars, setSelectedLoraChars] = useState<{id:string;name:string;strength:number}[]>([]);
  const [selectedLoraStyles,setSelectedLoraStyles]= useState<{name:string;strength:number}[]>([]);

  // ── Klein-specific state ──────────────────────────────────────────────────
  const [kleinImages,       setKleinImages]       = useState<(string|null)[]>([null, null, null, null]);
  const [kleinSeed,         setKleinSeed]         = useState('');
  const [kleinSafety,       setKleinSafety]       = useState(2);
  const [kleinOutputFormat, setKleinOutputFormat] = useState<'png'|'jpeg'>('jpeg');

  // ── LoRA state (shared) ───────────────────────────────────────────────────
  const [loras,             setLoras]             = useState<any>({ default: [], customs: [] });
  const [lorasLoaded,       setLorasLoaded]       = useState(false);

  // ── Style transfer tab state ──────────────────────────────────────────────
  const [stSourceImage,     setStSourceImage]     = useState<string | null>(null);
  const [stStyleImage,      setStStyleImage]      = useState<string | null>(null);

  // ── Character LoRA training tab state ────────────────────────────────────
  const [loraName,          setLoraName]          = useState('');
  const [loraGender,        setLoraGender]        = useState('');
  const [loraImages,        setLoraImages]        = useState<string[]>([]);
  const [loraTraining,      setLoraTraining]      = useState<JobStatus>('idle');
  const [loraMsg,           setLoraMsg]           = useState('');

  // ── Shared job state ──────────────────────────────────────────────────────
  const [jobStatus,   setJobStatus]   = useState<JobStatus>('idle');
  const [statusMsg,   setStatusMsg]   = useState('');
  const [resultImages,setResultImages]= useState<string[]>([]);

  const pollRef    = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promptRef  = useRef('');

  useEffect(() => () => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Load LoRAs when key is available
  const loadLoras = useCallback(async () => {
    if (!freepikApiKey || lorasLoaded) return;
    try {
      const r = await fetch(`/api/image/loras?api_key=${encodeURIComponent(freepikApiKey)}`);
      if (!r.ok) return;
      const data = await r.json();
      setLoras(data?.data || { default: [], customs: [] });
      setLorasLoaded(true);
    } catch {}
  }, [freepikApiKey, lorasLoaded]);

  useEffect(() => { loadLoras(); }, [loadLoras]);

  // ── Polling helper ────────────────────────────────────────────────────────
  const freepikKeyRef = useRef(freepikApiKey);
  useEffect(() => { freepikKeyRef.current = freepikApiKey; }, [freepikApiKey]);

  const startPolling = (taskId: string, statusEndpoint: string) => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    let consecutiveErrors = 0;
    const log = (msg: string) => console.log(`[ImageGen] ${msg}`);

    log(`Polling started — taskId: ${taskId}`);

    pollRef.current = setInterval(async () => {
      try {
        const key = freepikKeyRef.current || '';
        const url = `${statusEndpoint}/${taskId}?api_key=${encodeURIComponent(key)}`;
        const r = await fetch(url);

        if (!r.ok) {
          consecutiveErrors++;
          log(`HTTP ${r.status} error (${consecutiveErrors}/5)`);
          if (consecutiveErrors >= 5) {
            clearInterval(pollRef.current!); clearTimeout(timeoutRef.current!); pollRef.current = null;
            let errMsg = `Polling failed: HTTP ${r.status}`;
            try { const e = await r.json(); errMsg = e.error || errMsg; } catch {}
            log(`Stopped: ${errMsg}`);
            setJobStatus('failed'); setStatusMsg(errMsg);
            addToast({ title: 'Generation failed', message: errMsg, type: 'error' });
          }
          return;
        }

        consecutiveErrors = 0;
        const data = await r.json();
        const status = String(data.status || '').toUpperCase();
        const urlCount = (data._imageUrls || []).length;
        log(`status=${status} urls=${urlCount} generated=${JSON.stringify(data.generated || []).slice(0,80)}`);

        if (status === 'COMPLETED') {
          clearInterval(pollRef.current!); clearTimeout(timeoutRef.current!); pollRef.current = null;
          const urls: string[] = data._imageUrls || data.generated || [];
          if (urls.length > 0) {
            setResultImages(urls); setJobStatus('succeeded'); setStatusMsg('');
            urls.forEach((url, i) => addToGallery({
              id: `generated-${Date.now()}-${i}`, type: 'generated', mediaType: 'image',
              url, prompt: promptRef.current, timestamp: Date.now(),
            }));
            addToast({ title: 'Done!', message: 'Saved to gallery.', type: 'success' });
          } else {
            log('COMPLETED but no URLs in response');
            setJobStatus('failed'); setStatusMsg('Task completed but no images returned. May have been filtered for content.');
          }
        } else if (['FAILED','ERROR','CANCELLED'].includes(status)) {
          clearInterval(pollRef.current!); clearTimeout(timeoutRef.current!); pollRef.current = null;
          const msg = data.error || data.message || `Generation ${status.toLowerCase()}.`;
          log(`Terminal status: ${status} — ${msg}`);
          setJobStatus('failed'); setStatusMsg(msg);
          addToast({ title: 'Generation failed', message: msg, type: 'error' });
        }
      } catch (e: any) {
        consecutiveErrors++;
        const msg = e.message || 'unknown error';
        log(`Exception (${consecutiveErrors}/5): ${msg}`);
        if (consecutiveErrors >= 5) {
          clearInterval(pollRef.current!); clearTimeout(timeoutRef.current!); pollRef.current = null;
          setJobStatus('failed'); setStatusMsg('Lost connection while waiting for generation.');
        }
      }
    }, 4000);

    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current); pollRef.current = null;
        log('Timed out after 3 minutes');
        setJobStatus('failed'); setStatusMsg('Timed out after 3 minutes.');
      }
    }, 3 * 60 * 1000);
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) { addToast({ title: 'Prompt required', message: 'Describe the image you want.', type: 'warning' }); return; }
    if (!freepikApiKey) { addToast({ title: 'No Freepik key', message: 'Add your key in Settings.', type: 'warning' }); return; }

    setJobStatus('creating'); setStatusMsg('Creating task…'); setResultImages([]);

    const hasStructureRef = useReference && hasRef;
    const usingRefs = hasStructureRef && !!styleRefImage;
    const appearance = aiProfile.appearance?.trim();
    let finalPrompt = prompt.trim();
    // Always prepend appearance description — not just when structure ref is on
    if (appearance) finalPrompt = `${appearance}. ${finalPrompt}`;
    promptRef.current = finalPrompt;

    try {
      // ── Flux 2 Klein ──────────────────────────────────────────────────────
      if (engine === 'klein') {
        // Appearance is already in finalPrompt above
        let kleinPrompt = finalPrompt;
        promptRef.current = kleinPrompt;

        // Resolve actual images to send — slot 0 auto-fills with persona photo
        const resolvedImages = kleinImages.map((img, i) => {
          if (img) return img;
          if (i === 0 && hasRef && aiProfile.referenceImage) return aiProfile.referenceImage;
          return null;
        }).filter(Boolean) as string[];

        const body: any = {
          prompt: kleinPrompt,
          aspectRatio,
          resolution,
          inputImages: resolvedImages,
          safetyTolerance: kleinSafety,
          outputFormat: kleinOutputFormat,
          apiKey: freepikApiKey,
        };
        if (kleinSeed.trim()) {
          const s = parseInt(kleinSeed.trim(), 10);
          if (!isNaN(s)) body.seed = s;
        }

        const r = await fetch('/api/image/generate-klein', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
        const result = await r.json();
        const taskId = result.taskId;
        if (!taskId) throw new Error(`No task ID returned. Response: ${JSON.stringify(result)}`);
        console.log(`[ImageGen Klein] Task created: ${taskId}, refs: ${resolvedImages.length}, prompt: "${kleinPrompt.slice(0,80)}"`);
        setJobStatus('waiting'); setStatusMsg('Generating with Flux 2 Klein…');
        startPolling(taskId, '/api/image/status-klein');

      // ── Mystic ────────────────────────────────────────────────────────────
      } else {
        let enrichedPrompt = finalPrompt;
        // Inject @charactername — Freepik requires the LoRA name in the prompt,
        // NOT the numeric ID. e.g. @sara not @2
        if (!usingRefs && selectedLoraChars.length > 0) {
          selectedLoraChars.forEach((c: any) => {
            // c.name is the LoRA's name string; c.id is the numeric ID
            // The @ syntax uses the name
            const tag = `@${c.name || c.id}`;
            if (!enrichedPrompt.includes(tag)) enrichedPrompt = `${tag} ${enrichedPrompt}`;
          });
        }
        promptRef.current = enrichedPrompt;
        console.log(`[ImageGen Mystic] prompt: "${enrichedPrompt.slice(0,120)}", structRef:${hasStructureRef}, styleRef:${!!styleRefImage}, loraChars:${selectedLoraChars.length}`);

        const body: any = {
          prompt: enrichedPrompt, aspectRatio, resolution, model,
          adherence, hdr, creativeDetailing, apiKey: freepikApiKey,
          ...(negPrompt.trim() ? { negativePrompt: negPrompt.trim() } : {}),
          ...(hasStructureRef ? { structureReference: aiProfile.referenceImage, structureStrength } : {}),
          ...(styleRefImage   ? { styleReference: styleRefImage } : {}),
          ...(!usingRefs && selectedLoraChars.length  > 0 ? { loraCharacters: selectedLoraChars  } : {}),
          ...(!usingRefs && selectedLoraStyles.length > 0 ? { loraStyles:     selectedLoraStyles } : {}),
        };

        const r = await fetch('/api/image/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
        const result = await r.json();
        const taskId = result.taskId;
        if (!taskId) throw new Error(`No task ID returned. Response: ${JSON.stringify(result)}`);
        console.log(`[ImageGen Mystic] Task created: ${taskId}`);
        setJobStatus('waiting'); setStatusMsg(`Generating with Mystic at ${RESOLUTIONS.find(x=>x.value===resolution)?.label||resolution}…`);
        startPolling(taskId, '/api/image/status');
      }
    } catch (e: any) {
      setJobStatus('failed'); setStatusMsg(e.message);
      addToast({ title: 'Failed', message: e.message, type: 'error' });
    }
  };

  // ── Style Transfer ────────────────────────────────────────────────────────
  const handleStyleTransfer = async () => {
    if (!stSourceImage || !stStyleImage) { addToast({ title: 'Both images required', message: 'Upload a source image and a style reference image.', type: 'warning' }); return; }
    if (!freepikApiKey) { addToast({ title: 'No Freepik key', message: 'Add your key in Settings.', type: 'warning' }); return; }

    setJobStatus('creating'); setStatusMsg('Starting style transfer…'); setResultImages([]);
    promptRef.current = 'Style transfer';

    try {
      const r = await fetch('/api/image/style-transfer', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ image: stSourceImage, referenceImage: stStyleImage, apiKey: freepikApiKey }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
      const { taskId } = await r.json();
      setJobStatus('waiting'); setStatusMsg('Transferring style…');
      startPolling(taskId, '/api/image/style-transfer');
    } catch (e: any) {
      setJobStatus('failed'); setStatusMsg(e.message);
      addToast({ title: 'Failed', message: e.message, type: 'error' });
    }
  };

  // ── LoRA training ─────────────────────────────────────────────────────────
  const loraImageRef = useRef<HTMLInputElement>(null);

  const addLoraImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => setLoraImages(prev => [...prev, (reader.result as string).split(',')[1]]);
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const handleTrainLora = async () => {
    if (!loraName.trim()) { addToast({ title: 'Name required', message: 'Give your character a name.', type: 'warning' }); return; }
    if (loraImages.length < 8) { addToast({ title: 'More images needed', message: `Upload at least 8 images. You have ${loraImages.length}.`, type: 'warning' }); return; }
    if (!freepikApiKey) { addToast({ title: 'No Freepik key', message: 'Add your key in Settings.', type: 'warning' }); return; }

    setLoraTraining('creating'); setLoraMsg('Sending training images…');
    try {
      const r = await fetch('/api/image/loras/character', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: loraName.trim(), gender: loraGender || undefined, images: loraImages, apiKey: freepikApiKey }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Training failed'); }
      setLoraTraining('waiting');
      setLoraMsg('Training started! This takes a few minutes. Check back in Settings → LoRAs or wait for it to appear in the LoRA list on the Generate tab.');
      addToast({ title: 'Training started!', message: `"${loraName}" character LoRA is training.`, type: 'success' });
      setLoraImages([]); setLoraName(''); setLoraGender('');
      setLorasLoaded(false); // force refresh next time
    } catch (e: any) {
      setLoraTraining('failed'); setLoraMsg(e.message);
      addToast({ title: 'Training failed', message: e.message, type: 'error' });
    }
  };

  const isGenerating = jobStatus === 'creating' || jobStatus === 'waiting';
  const allLoras = [...(loras.default || []), ...(loras.customs || [])];
  const characterLoras = allLoras.filter((l: any) => l.type === 'character');
  const styleLoras     = allLoras.filter((l: any) => l.type === 'style');
  const usingRefs = (useReference && hasRef) && !!styleRefImage;
  const aspectRatios = engine === 'klein' ? ASPECT_RATIOS_KLEIN : ASPECT_RATIOS_MYSTIC;

  const downloadImage = (url: string, i: number) => {
    const a = document.createElement('a');
    a.href = url; a.download = `indigo-image-${Date.now()}-${i}.png`; a.target = '_blank'; a.click();
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Image Generator</h2>
        <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">Powered by Freepik</p>
      </div>

      {!freepikApiKey && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Add your Freepik API key in Settings. New accounts get $5 free at{' '}
          <a href="https://www.freepik.com/developers/dashboard" target="_blank" rel="noreferrer" className="underline font-medium">freepik.com/developers</a>.
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-1 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl border border-indigo-100 dark:border-indigo-800">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 shadow-sm' : 'text-indigo-400 hover:text-indigo-600 dark:text-indigo-500 dark:hover:text-indigo-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Engine selector — shown on Generate tab */}
      {activeTab === 'Generate' && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">AI Engine</p>
          <div className="space-y-2">
            {ENGINES.map(eng => (
              <button key={eng.value} onClick={() => setEngine(eng.value)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${engine === eng.value ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-800/60' : 'border-indigo-200 dark:border-indigo-700 hover:border-indigo-400'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${engine === eng.value ? 'border-indigo-600 bg-indigo-600' : 'border-indigo-400'}`} />
                <div>
                  <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-100">{eng.label.split(' — ')[0]}</p>
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400">{eng.label.split(' — ')[1]}</p>
                </div>
              </button>
            ))}
          </div>
          {engine === 'klein' && (
            <p className="text-[10px] text-indigo-400 dark:text-indigo-500 mt-2">
              Flux 2 Klein sends your reference photo directly as a subject guide — better character face consistency than Mystic's structure reference. Sub-second generation. No LoRA support.
            </p>
          )}
        </div>
      )}

      {/* ── GENERATE TAB ── */}
      {activeTab === 'Generate' && (
        <div className="space-y-4">

          {/* ── MYSTIC: Structure + Style reference slots ── */}
          {engine === 'mystic' && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3">
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Reference Images</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Slot 1 — Character / Structure */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Character Reference</p>
                <p className="text-[10px] text-indigo-400 dark:text-indigo-500">Guides face shape and body proportions</p>
                {hasRef && useReference ? (
                  <div className="relative">
                    <img src={aiProfile.referenceImage!} alt="Structure ref"
                      className="w-full aspect-square object-cover rounded-xl border-2 border-indigo-400 dark:border-indigo-500" />
                    <div className="absolute bottom-1 left-1 right-1 bg-indigo-600/80 rounded-lg px-1.5 py-0.5 text-[9px] text-white text-center truncate">
                      {aiProfile.name}'s profile image
                    </div>
                    <button onClick={() => setUseReference(false)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => hasRef ? setUseReference(true) : undefined}
                    className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${hasRef ? 'border-indigo-400 dark:border-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800 cursor-pointer text-indigo-500' : 'border-indigo-200 dark:border-indigo-700 text-indigo-300 dark:text-indigo-600 cursor-default'}`}>
                    <User className="w-5 h-5" />
                    <span className="text-[10px] text-center px-1">
                      {hasRef ? `Use ${aiProfile.name}'s photo` : 'Add reference photo in AI Profile'}
                    </span>
                  </button>
                )}
              </div>
              {/* Slot 2 — Style Reference */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Style Reference</p>
                <p className="text-[10px] text-indigo-400 dark:text-indigo-500">Transfers look, lighting, and aesthetic</p>
                {styleRefImage ? (
                  <div className="relative">
                    <img src={styleRefImage} alt="Style ref"
                      className="w-full aspect-square object-cover rounded-xl border-2 border-indigo-400 dark:border-indigo-500" />
                    <button onClick={() => setStyleRefImage(null)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full aspect-square rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-600 flex flex-col items-center justify-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors cursor-pointer text-indigo-400 dark:text-indigo-500">
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px] text-center px-1">Upload style image</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () => setStyleRefImage(reader.result as string);
                        reader.readAsDataURL(f); e.target.value = '';
                      }} />
                  </label>
                )}
              </div>
            </div>
            {useReference && hasRef && (
              <div className="pt-1 space-y-2">
                <Slider label="Structure Strength" value={structureStrength} min={0} max={100} onChange={setStructureStrength} />
                <p className="text-[10px] text-indigo-400 -mt-1"><strong>20–40</strong> = face/hair/body only. <strong>60–80</strong> = also copies pose &amp; outfit.</p>
              </div>
            )}
            {useReference && hasRef && !aiProfile.appearance && (
              <p className="text-[10px] text-amber-500 dark:text-amber-400">No appearance description in AI Profile — hair/eye/skin colors may not match.</p>
            )}
            {useReference && hasRef && aiProfile.appearance && (
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400">
                <span className="font-medium">Appearance included: </span>
                {aiProfile.appearance.slice(0, 100)}{aiProfile.appearance.length > 100 ? '…' : ''}
              </p>
            )}
            {usingRefs && selectedLoraChars.length + selectedLoraStyles.length > 0 && (
              <p className="text-[10px] text-amber-500">⚠ LoRAs are ignored when both reference images are active.</p>
            )}
          </div>
          )}

          {/* ── KLEIN: 4 equal image slots in a 2×2 grid ── */}
          {engine === 'klein' && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3">
            <div>
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Reference Images</p>
              <p className="text-[10px] text-indigo-400 dark:text-indigo-500 mt-0.5">Up to 4 images — the model uses all of them together to guide style, subject, and character appearance.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([0,1,2,3] as const).map(i => {
                const label = i === 0 ? 'Image 1' : `Image ${i+1}`;
                // Slot 0 can auto-use the persona's photo
                const isPersonaSlot = i === 0;
                const val = kleinImages[i];
                const setVal = (v: string | null) => setKleinImages(prev => { const n=[...prev]; n[i]=v; return n; });

                // Auto-fill slot 0 with persona photo if available and not overridden
                const displayImg = val ?? (isPersonaSlot && hasRef ? aiProfile.referenceImage! : null);
                const isAutoFilled = !val && isPersonaSlot && hasRef;

                return (
                  <div key={i} className="space-y-1">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{label}{isAutoFilled ? <span className="text-[9px] text-indigo-400 ml-1">(auto)</span> : ''}</p>
                    {displayImg ? (
                      <div className="relative">
                        <img src={displayImg} alt={label}
                          className={`w-full aspect-square object-cover rounded-xl border-2 ${isAutoFilled ? 'border-indigo-300 dark:border-indigo-600' : 'border-indigo-400 dark:border-indigo-500'}`} />
                        {isAutoFilled ? (
                          <div className="absolute bottom-1 left-1 right-1 bg-indigo-600/80 rounded-lg px-1.5 py-0.5 text-[9px] text-white text-center truncate">{aiProfile.name}'s photo</div>
                        ) : (
                          <button onClick={() => setVal(null)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {isAutoFilled && (
                          <button onClick={() => setVal(null /* override to clear */)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 text-white rounded-full flex items-center justify-center"
                            title="Remove auto-filled photo">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className="w-full aspect-square rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-600 flex flex-col items-center justify-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors cursor-pointer text-indigo-400 dark:text-indigo-500">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px]">Upload</span>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]; if (!f) return;
                            const reader = new FileReader();
                            reader.onload = () => setVal(reader.result as string);
                            reader.readAsDataURL(f); e.target.value = '';
                          }} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
              placeholder={`Describe the scene — e.g. "${aiProfile.name} sitting in a cozy café, warm lighting, photorealistic"`}
              className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
          </div>

          {/* Core controls — shared ratio + resolution, then engine-specific */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Ratio</label>
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
                className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
                {aspectRatios.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Resolution</label>
              <select value={resolution} onChange={e => setResolution(e.target.value)}
                className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
                {RESOLUTIONS.filter(r => engine === 'klein' ? r.value !== '4k' : true).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {/* Mystic-only: Style model */}
          {engine === 'mystic' && (
            <div>
              <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Style</label>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}

          {/* Klein-only: Seed + Safety Tolerance + Output Format */}
          {engine === 'klein' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                    Seed <span className="font-normal text-indigo-400">(optional)</span>
                  </label>
                  <input type="number" value={kleinSeed} onChange={e => setKleinSeed(e.target.value)}
                    placeholder="Random"
                    min={0} max={4294967295}
                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <p className="text-[10px] text-indigo-400 mt-0.5">Same seed = same image. Useful for variations.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Safety Tolerance</label>
                  <select value={kleinSafety} onChange={e => setKleinSafety(Number(e.target.value))}
                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
                    <option value={0}>0 — Strictest</option>
                    <option value={1}>1</option>
                    <option value={2}>2 — Default</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5 — Most lenient</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Output Format</label>
                <div className="flex gap-2">
                  {(['jpeg','png'] as const).map(fmt => (
                    <button key={fmt} onClick={() => setKleinOutputFormat(fmt)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${kleinOutputFormat === fmt ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-800/60 text-indigo-700 dark:text-indigo-200' : 'border-indigo-200 dark:border-indigo-700 text-indigo-500 hover:border-indigo-400'}`}>
                      {fmt.toUpperCase()} {fmt === 'jpeg' ? '— smaller file' : '— lossless'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings — Mystic only */}
          {engine === 'mystic' && (
            <div>
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 py-1">
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced Settings
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Negative Prompt</label>
                    <input type="text" value={negPrompt} onChange={e => setNegPrompt(e.target.value)}
                      placeholder="What to avoid — e.g. blurry, distorted face, extra limbs"
                      className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <Slider label="Adherence" value={adherence} min={0} max={100} onChange={setAdherence} />
                    <p className="text-[10px] text-indigo-400 -mt-1"><strong>Higher</strong> = sticks closer to your prompt. <strong>Lower</strong> = more creative. Default 50.</p>
                  </div>
                  <div>
                    <Slider label="HDR" value={hdr} min={0} max={100} onChange={setHdr} />
                    <p className="text-[10px] text-indigo-400 -mt-1"><strong>Higher</strong> = more vivid lighting. <strong>Lower</strong> = softer tones. Default 50.</p>
                  </div>
                  <div>
                    <Slider label="Creative Detailing" value={creativeDetailing} min={0} max={100} onChange={setCreativeDetailing} />
                    <p className="text-[10px] text-indigo-400 -mt-1"><strong>Higher</strong> = sharper detail. <strong>Lower</strong> = more natural look. Default 33.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim() || !freepikApiKey}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />{statusMsg || 'Generating…'}</> : <><Wand2 className="w-4 h-4" />Generate Image</>}
          </button>

          {/* LoRA section — Mystic only, below generate button */}
          {engine === 'mystic' && freepikApiKey && (lorasLoaded ? allLoras.length > 0 : true) && (
            <div className={`p-3 rounded-xl border space-y-3 transition-opacity ${usingRefs ? 'opacity-50' : ''} bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Your LoRAs</p>
                <button onClick={() => { setLorasLoaded(false); setTimeout(loadLoras, 100); }}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              {usingRefs && (
                <p className="text-[10px] text-amber-500 dark:text-amber-400">LoRAs are disabled when both a character reference AND a style reference are active at the same time (Freepik limitation). Turn off one of the image slots to use a LoRA alongside the other.</p>
              )}
              {!lorasLoaded && <p className="text-xs text-indigo-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Loading…</p>}
              {lorasLoaded && allLoras.length === 0 && (
                <p className="text-xs text-indigo-400">No LoRAs yet — train one on the Character LoRA tab.</p>
              )}
              {lorasLoaded && characterLoras.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Characters</p>
                  <div className="space-y-1">
                    {characterLoras.map((l: any) => {
                      const sel = selectedLoraChars.find(x => x.id === String(l.id));
                      const isTraining = ['training','queued','pending'].includes(l.training?.status);
                      return (
                        <div key={l.id}
                          onClick={() => !usingRefs && !isTraining && setSelectedLoraChars(prev =>
                            sel ? prev.filter(x => x.id !== String(l.id)) : [...prev, { id: String(l.id), name: l.name, strength: 100 }]
                          )}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-colors
                            ${sel && !usingRefs ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-800/60' : 'border-indigo-200 dark:border-indigo-700'}
                            ${!usingRefs && !isTraining ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default'}`}>
                          {l.preview && <img src={l.preview} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100 truncate">{l.name}</p>
                            <p className={`text-[10px] ${isTraining ? 'text-amber-500' : 'text-indigo-400'}`}>
                              {isTraining ? '⏳ Still training…' : l.training?.status || 'ready'}
                            </p>
                          </div>
                          {sel && !usingRefs && <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {lorasLoaded && styleLoras.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Styles</p>
                  <div className="space-y-1">
                    {styleLoras.map((l: any) => {
                      const sel = selectedLoraStyles.find(x => x.name === l.name);
                      return (
                        <div key={l.id || l.name}
                          onClick={() => !usingRefs && setSelectedLoraStyles(prev =>
                            sel ? prev.filter(x => x.name !== l.name) : [...prev, { name: l.name, strength: 100 }]
                          )}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-colors
                            ${sel && !usingRefs ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-800/60' : 'border-indigo-200 dark:border-indigo-700'}
                            ${!usingRefs ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default'}`}>
                          {l.preview && <img src={l.preview} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100 truncate">{l.name}</p>
                            {l.description && <p className="text-[10px] text-indigo-400 truncate">{l.description}</p>}
                          </div>
                          {sel && !usingRefs && <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STYLE TRANSFER TAB ── */}
      {activeTab === 'Style Transfer' && (
        <div className="space-y-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
            Style Transfer takes any two images and applies the visual look of one onto the other — colors, texture, lighting, artistic style.
          </div>
          <ImagePickerButton label="Source Image (what to transform)" value={stSourceImage} onChange={setStSourceImage} />
          <ImagePickerButton label="Style Image (the look to copy)" value={stStyleImage} onChange={setStStyleImage} />
          <button onClick={handleStyleTransfer} disabled={isGenerating || !stSourceImage || !stStyleImage || !freepikApiKey}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />{statusMsg}</> : <><Palette className="w-4 h-4" />Transfer Style</>}
          </button>
        </div>
      )}

      {/* ── CHARACTER LORA TAB ── */}
      {activeTab === 'Character LoRA' && (
        <div className="space-y-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400 space-y-1">
            <p><strong>Train a Character LoRA</strong> — upload 8–20 photos of your AI persona and Freepik will train a small custom model that remembers their face and appearance. Once trained it will appear in the <strong>Your LoRAs</strong> section on the Generate tab.</p>
            <p>Training takes several minutes. Once complete, turn off both reference image slots on the Generate tab and select your LoRA from the list. Use <strong>@charactername</strong> in your prompt for best results.</p>
            <p className="text-amber-500 dark:text-amber-400">⚠ Training uses Freepik credits. Check your balance at <a href="https://www.freepik.com/developers/dashboard" target="_blank" rel="noreferrer" className="underline">freepik.com/developers/dashboard</a>.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Character Name</label>
            <input type="text" value={loraName} onChange={e => setLoraName(e.target.value)}
              placeholder={`e.g. "${aiProfile.name}"`}
              className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Gender <span className="font-normal text-indigo-400">(optional, helps training)</span></label>
            <select value={loraGender} onChange={e => setLoraGender(e.target.value)}
              className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Training Images <span className="text-indigo-400 font-normal">({loraImages.length}/20 — min 8)</span></label>
              <button onClick={() => loraImageRef.current?.click()}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                <Plus className="w-3 h-3" /> Add images
              </button>
              <input ref={loraImageRef} type="file" accept="image/*" multiple className="hidden" onChange={addLoraImages} />
            </div>
            {loraImages.length === 0 ? (
              <button onClick={() => loraImageRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-indigo-400 dark:text-indigo-500 text-sm flex flex-col items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
                <Upload className="w-6 h-6" />
                Tap to upload photos
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {loraImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={`data:image/jpeg;base64,${img}`} alt="" className="w-full aspect-square object-cover rounded-lg border border-indigo-200 dark:border-indigo-700" />
                    <button onClick={() => setLoraImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => loraImageRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg flex items-center justify-center text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
            <p className="text-[10px] text-indigo-400 mt-1">Use clear, well-lit photos. Variety helps — different angles, expressions, and lighting give better results.</p>
          </div>

          <button onClick={handleTrainLora}
            disabled={loraTraining === 'creating' || loraTraining === 'waiting' || loraImages.length < 8 || !loraName.trim() || !freepikApiKey}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loraTraining === 'creating' || loraTraining === 'waiting'
              ? <><RefreshCw className="w-4 h-4 animate-spin" />Training…</>
              : <><Wand2 className="w-4 h-4" />Train Character LoRA</>}
          </button>

          {loraMsg && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${loraTraining === 'failed' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 text-red-700 dark:text-red-300' : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 text-indigo-700 dark:text-indigo-300'}`}>
              {loraTraining === 'waiting' ? <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" /> : loraTraining === 'failed' ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <p>{loraMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* Shared error */}
      {jobStatus === 'failed' && statusMsg && activeTab !== 'Character LoRA' && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{statusMsg}</p>
        </div>
      )}

      {/* Results */}
      {resultImages.length > 0 && (
        <div className="space-y-4">
          {resultImages.map((url, i) => (
            <div key={i} className="space-y-2">
              <img src={url} alt={`Result ${i+1}`} className="w-full rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-lg" />
              <button onClick={() => downloadImage(url, i)}
                className="w-full flex items-center justify-center gap-2 py-2 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          ))}
          <button onClick={() => { setResultImages([]); setJobStatus('idle'); setPrompt(''); }}
            className="w-full py-2 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
            New Image
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageGeneratorScreen;
