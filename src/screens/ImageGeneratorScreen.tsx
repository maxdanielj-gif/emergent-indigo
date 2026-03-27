import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Download, RefreshCw, Image as ImageIcon, User, X, ChevronDown, ChevronUp } from 'lucide-react';

// Freepik Mystic aspect ratio values
const ASPECT_RATIOS = [
  { label: 'Square (1:1)',     value: 'square_1_1'       },
  { label: 'Portrait (2:3)',   value: 'portrait_2_3'     },
  { label: 'Landscape (3:2)',  value: 'landscape_3_2'    },
  { label: 'Tall (9:16)',      value: 'portrait_9_16'    },
  { label: 'Wide (16:9)',      value: 'widescreen_16_9'  },
  { label: 'Classic (4:3)',    value: 'classic_4_3'      },
];

const RESOLUTIONS = [
  { label: '1K — Fast (10–20s)',           value: '1k'  },
  { label: '2K — Balanced (20–40s)',        value: '2k'  },
  { label: '4K — High detail (40–90s)',     value: '4k'  },
];

const MODELS = [
  { label: 'Realism (photorealistic)',  value: 'realism'   },
  { label: 'Anime',                     value: 'anime'     },
  { label: '2.5D',                      value: '2_5d'      },
];

type JobStatus = 'idle' | 'creating' | 'waiting' | 'succeeded' | 'failed';

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

const ImageGeneratorScreen: React.FC = () => {
  const { freepikApiKey, aiProfile, addToGallery, addToast } = useApp();

  const hasReference = !!aiProfile.referenceImage;

  const [useReference,      setUseReference]      = useState(hasReference);
  const [prompt,            setPrompt]            = useState('');
  const [negPrompt,         setNegPrompt]         = useState('');
  const [aspectRatio,       setAspectRatio]       = useState('square_1_1');
  const [resolution,        setResolution]        = useState('2k');
  const [model,             setModel]             = useState('realism');
  const [structureStrength, setStructureStrength] = useState(70);
  const [adherence,         setAdherence]         = useState(50);
  const [hdr,               setHdr]               = useState(50);
  const [creativeDetailing, setCreativeDetailing] = useState(33);
  const [showAdvanced,      setShowAdvanced]      = useState(false);
  const [jobStatus,         setJobStatus]         = useState<JobStatus>('idle');
  const [statusMsg,         setStatusMsg]         = useState('');
  const [resultImages,      setResultImages]      = useState<string[]>([]);

  const pollRef    = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promptRef  = useRef('');

  useEffect(() => () => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ title: 'Prompt required', message: 'Describe the image you want.', type: 'warning' });
      return;
    }
    if (!freepikApiKey) {
      addToast({ title: 'No Freepik key', message: 'Add your Freepik API key in Settings first.', type: 'warning' });
      return;
    }

    setJobStatus('creating');
    setStatusMsg('Creating task…');
    setResultImages([]);

    const hasRef     = useReference && hasReference;
    const appearance = aiProfile.appearance?.trim();

    // Prepend appearance description when using reference image
    let finalPrompt = prompt.trim();
    if (hasRef && appearance) {
      finalPrompt = `${appearance}. ${finalPrompt}`;
    }
    promptRef.current = finalPrompt;

    try {
      const body: any = {
        prompt:      finalPrompt,
        aspectRatio,
        resolution,
        model,
        adherence,
        hdr,
        creativeDetailing,
        apiKey: freepikApiKey,
        ...(negPrompt.trim() ? { negativePrompt: negPrompt.trim() } : {}),
        ...(hasRef ? {
          structureReference: aiProfile.referenceImage,
          structureStrength,
        } : {}),
      };

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start generation');
      }

      const { taskId } = await res.json();
      const resLabel = RESOLUTIONS.find(r => r.value === resolution)?.label || resolution;
      setJobStatus('waiting');
      setStatusMsg(`Generating at ${resLabel}…`);
      startPolling(taskId);
    } catch (e: any) {
      setJobStatus('failed');
      setStatusMsg(e.message);
      addToast({ title: 'Generation failed', message: e.message, type: 'error' });
    }
  };

  const startPolling = (taskId: string) => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/image/status/${taskId}?api_key=${encodeURIComponent(freepikApiKey || '')}`);
        if (!res.ok) return;
        const data = await res.json();
        const status = String(data.status || '').toUpperCase();

        if (status === 'COMPLETED') {
          clearInterval(pollRef.current!);
          clearTimeout(timeoutRef.current!);
          pollRef.current = null;

          const urls: string[] = data._imageUrls || [];
          if (urls.length > 0) {
            setResultImages(urls);
            setJobStatus('succeeded');
            setStatusMsg('');
            urls.forEach((url, i) => addToGallery({
              id: `generated-${Date.now()}-${i}`,
              type: 'generated', mediaType: 'image',
              url, prompt: promptRef.current, timestamp: Date.now(),
            }));
            addToast({ title: 'Done!', message: `${urls.length} image${urls.length > 1 ? 's' : ''} saved to gallery.`, type: 'success' });
          } else {
            setJobStatus('failed');
            setStatusMsg('Task completed but no images returned. The image may have been filtered.');
          }
        } else if (['FAILED', 'ERROR', 'CANCELLED'].includes(status)) {
          clearInterval(pollRef.current!);
          clearTimeout(timeoutRef.current!);
          pollRef.current = null;
          const msg = data.error || data.message || 'Generation failed.';
          setJobStatus('failed');
          setStatusMsg(msg);
          addToast({ title: 'Failed', message: msg, type: 'error' });
        }
        // IN_PROGRESS / CREATED — keep polling
      } catch {}
    }, 3000);

    // 3-minute hard timeout
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setJobStatus('failed');
        setStatusMsg('Timed out after 3 minutes. Check freepik.com/developers/dashboard to see your tasks.');
      }
    }, 3 * 60 * 1000);
  };

  const handleDownload = (url: string, i: number) => {
    const a = document.createElement('a');
    a.href = url; a.download = `indigo-image-${Date.now()}-${i}.png`;
    a.target = '_blank'; a.click();
  };

  const isGenerating = jobStatus === 'creating' || jobStatus === 'waiting';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Image Generator</h2>
        <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">Powered by Freepik Mystic</p>
      </div>

      {!freepikApiKey && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Add your Freepik API key in Settings. New accounts get $5 free at{' '}
          <a href="https://www.freepik.com/developers/dashboard" target="_blank" rel="noreferrer" className="underline font-medium">freepik.com/developers</a>.
        </div>
      )}

      {/* Reference image */}
      {hasReference ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <img src={aiProfile.referenceImage!} alt="Reference"
                className="w-10 h-10 rounded-lg object-cover border border-indigo-200 dark:border-indigo-700" />
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                  Use {aiProfile.name}'s reference image
                </p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400">
                  Structure reference — guides character shape and form
                </p>
              </div>
            </div>
            <button onClick={() => setUseReference(!useReference)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${useReference ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${useReference ? 'translate-x-2' : '-translate-x-2'}`} />
            </button>
          </div>

          {useReference && (
            <>
              {aiProfile.appearance ? (
                <div className="px-3 py-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg text-xs text-indigo-600 dark:text-indigo-300">
                  <span className="font-medium">Appearance included: </span>
                  {aiProfile.appearance.slice(0, 120)}{aiProfile.appearance.length > 120 ? '…' : ''}
                </div>
              ) : (
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                  No appearance description — add one in AI Profile so colors match correctly.
                </div>
              )}
              <Slider
                label="Structure Strength"
                value={structureStrength} min={0} max={100}
                onChange={setStructureStrength}
              />
              <p className="text-[10px] text-indigo-400 dark:text-indigo-500 -mt-2">
                On Freepik: <strong>higher = closer to reference image</strong>. Lower values give more creative freedom. Default 70 is a good balance.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
          <User className="w-4 h-4 flex-shrink-0" />
          Add a reference image in AI Profile for character-consistent generation.
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Prompt</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder={`Describe the scene — e.g. "${aiProfile.name} walking through a sunlit forest, cinematic photography, soft light"`}
          className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
      </div>

      {/* Core controls */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Ratio</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
            {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Resolution</label>
          <select value={resolution} onChange={e => setResolution(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
            {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Style</label>
          <select value={model} onChange={e => setModel(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs">
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Advanced settings */}
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
            <Slider label="Adherence — prompt vs. style fidelity" value={adherence} min={0} max={100} onChange={setAdherence} />
            <Slider label="HDR — dynamic range and contrast" value={hdr} min={0} max={100} onChange={setHdr} />
            <Slider label="Creative Detailing — detail vs. natural look" value={creativeDetailing} min={0} max={100} onChange={setCreativeDetailing} />
            <p className="text-[10px] text-indigo-400">Defaults: Adherence 50, HDR 50, Creative Detailing 33</p>
          </div>
        )}
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || !freepikApiKey}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {isGenerating
          ? <><RefreshCw className="w-4 h-4 animate-spin" />{statusMsg || 'Generating…'}</>
          : <><ImageIcon className="w-4 h-4" />Generate Image</>}
      </button>

      {/* Error */}
      {jobStatus === 'failed' && statusMsg && (
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
              <img src={url} alt={`Generated ${i + 1}`}
                className="w-full rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-lg" />
              <button onClick={() => handleDownload(url, i)}
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

      {/* Tips */}
      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Tips</p>
        <ul className="text-xs text-indigo-500 dark:text-indigo-400 space-y-1">
          <li>The reference image is used as a <strong>structure guide</strong> — it shapes the composition without transferring colors. Appearance description handles colors.</li>
          <li>Structure Strength 60–80 keeps the character recognizable while allowing scene creativity.</li>
          <li>1K is fastest for previews. Use 2K or 4K for final images.</li>
          <li>Generated images are saved to your Gallery automatically.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGeneratorScreen;
