import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Download, RefreshCw, Image as ImageIcon, User, X, ChevronDown, ChevronUp } from 'lucide-react';

const MJ_ASPECT_RATIOS  = ['1:1','9:16','16:9','3:4','4:3','4:5','5:4','5:6','6:5','2:3','3:2'];
const FLUX_ASPECT_RATIOS = ['1:1','9:16','16:9','4:3','3:4','3:2','2:3','21:9'];

type JobStatus = 'idle' | 'creating' | 'waiting' | 'succeeded' | 'failed';
type RefType   = 'image' | 'character' | 'style' | 'omni';

const REF_TYPES: { value: RefType; label: string; desc: string }[] = [
  { value: 'image',     label: 'Image (default)',  desc: 'Standard img2img — guides composition and content' },
  { value: 'character', label: 'Character ref',    desc: 'Keeps character appearance consistent' },
  { value: 'style',     label: 'Style ref',        desc: 'Transfers the visual style of the reference' },
  { value: 'omni',      label: 'Omni ref',         desc: 'Multi-purpose combined reference' },
];

function Slider({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{label}</span>
        <span className="text-xs text-indigo-500 dark:text-indigo-400">{value}</span>
      </div>
      <div className="relative w-full h-6 flex items-center">
        <div className="absolute w-full h-2 bg-indigo-200 dark:bg-indigo-700 rounded-full" />
        <div className="absolute h-2 bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-6" />
        <div className="absolute w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 10px)` }} />
      </div>
    </div>
  );
}

const ImageGeneratorScreen: React.FC = () => {
  const { shortApiKey, aiProfile, addToGallery, addToast } = useApp();

  const hasReference = !!aiProfile.referenceImage;
  const isMJ = (m: string) => m === 'midjourney/midjourney-v7/image-to-image';

  // Core state
  const [model,         setModel]         = useState('midjourney/midjourney-v7/image-to-image');
  const [useReference,  setUseReference]  = useState(hasReference);
  const [prompt,        setPrompt]        = useState('');
  const [negPrompt,     setNegPrompt]     = useState('');
  const [aspectRatio,   setAspectRatio]   = useState('1:1');

  // FLUX options
  const [fluxPerf,      setFluxPerf]      = useState<'schnell'|'dev'>('dev');

  // MJ general options
  const [mjPerf,        setMjPerf]        = useState<'speed'|'balance'|'quality'>('balance');
  const [stylization,   setStylization]   = useState(100);
  const [chaos,         setChaos]         = useState(0);
  const [weirdness,     setWeirdness]     = useState(0);

  // MJ reference image options
  const [refType,       setRefType]       = useState<RefType>('character');
  const [styleWeight,   setStyleWeight]   = useState(100);
  const [charWeight,    setCharWeight]    = useState(100);
  const [omniWeight,    setOmniWeight]    = useState(100);

  // UI
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [jobStatus,     setJobStatus]     = useState<JobStatus>('idle');
  const [statusMsg,     setStatusMsg]     = useState('');
  const [resultImages,  setResultImages]  = useState<string[]>([]);

  const pollRef    = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPromptRef = useRef('');

  useEffect(() => () => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // When switching models reset aspect ratio to a valid value
  const handleModelChange = (m: string) => {
    setModel(m);
    setAspectRatio('1:1');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ title: 'Prompt required', message: 'Describe the image you want.', type: 'warning' });
      return;
    }
    if (!shortApiKey) {
      addToast({ title: 'No ShortAPI key', message: 'Add your ShortAPI key in Settings first.', type: 'warning' });
      return;
    }
    if (model === 'shortapi/flux-1.0/image-to-image' && (!useReference || !hasReference)) {
      addToast({ title: 'Reference image required', message: 'FLUX requires a reference image. Enable the toggle or switch to Midjourney.', type: 'warning' });
      return;
    }

    setJobStatus('creating');
    setStatusMsg('Creating job…');
    setResultImages([]);

    const hasRef = useReference && hasReference;

    // Prepend appearance description when reference image is used
    const appearanceDesc = aiProfile.appearance?.trim();
    let finalPrompt = prompt.trim();
    if (hasRef && appearanceDesc) {
      finalPrompt = `${appearanceDesc}. ${finalPrompt}`;
    }
    currentPromptRef.current = finalPrompt;

    try {
      const body: any = {
        prompt:      finalPrompt,
        model,
        aspectRatio,
        apiKey:      shortApiKey,
        ...(negPrompt.trim() ? { negativePrompt: negPrompt.trim() } : {}),
        ...(hasRef ? { inputImageBase64: aiProfile.referenceImage } : {}),
      };

      if (model === 'shortapi/flux-1.0/image-to-image') {
        body.fluxPerformance = fluxPerf;
      } else {
        body.mjPerformance  = mjPerf;
        body.stylization    = stylization;
        body.chaos          = chaos;
        body.weirdness      = weirdness;
        if (hasRef) {
          body.imageReferenceType = refType;
          if (refType === 'style')     body.styleWeight     = styleWeight;
          if (refType === 'character') body.characterWeight = charWeight;
          if (refType === 'omni')      body.omniWeight      = omniWeight;
        }
      }

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start generation');
      }

      const { jobId } = await res.json();
      setJobStatus('waiting');
      setStatusMsg('Generating — usually 20–90 seconds…');
      startPolling(jobId);
    } catch (e: any) {
      setJobStatus('failed');
      setStatusMsg(e.message);
      addToast({ title: 'Generation failed', message: e.message, type: 'error' });
    }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/image/status/${jobId}?api_key=${encodeURIComponent(shortApiKey || '')}`);
        if (!res.ok) return;

        const data = await res.json();
        const status = String(data.status || '').toLowerCase();

        if (status === 'succeeded' || status === 'completed' || status === 'success') {
          clearInterval(pollRef.current!);
          clearTimeout(timeoutRef.current!);
          pollRef.current = null;

          const urls: string[] = (data._imageUrls && data._imageUrls.length > 0)
            ? data._imageUrls : [];

          if (urls.length > 0) {
            setResultImages(urls);
            setJobStatus('succeeded');
            setStatusMsg('');
            urls.forEach((url, i) => addToGallery({
              id: `generated-${Date.now()}-${i}`,
              type: 'generated', mediaType: 'image',
              url, prompt: currentPromptRef.current, timestamp: Date.now(),
            }));
            addToast({ title: 'Done!', message: `${urls.length} image${urls.length > 1 ? 's' : ''} saved to gallery.`, type: 'success' });
          } else {
            setJobStatus('failed');
            setStatusMsg(`Job succeeded but no image URL found. Raw: ${JSON.stringify(data.result ?? data.output ?? '').slice(0, 300)}`);
          }
        } else if (['failed','error','cancelled'].includes(status)) {
          clearInterval(pollRef.current!);
          clearTimeout(timeoutRef.current!);
          pollRef.current = null;
          const msg = data.error || data.message || data.reason || 'Generation failed.';
          setJobStatus('failed');
          setStatusMsg(msg);
          addToast({ title: 'Failed', message: msg, type: 'error' });
        }
      } catch {}
    }, 3000);

    // 3-minute hard timeout
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setJobStatus('failed');
        setStatusMsg('Timed out after 3 minutes. Check shortapi.ai to see if it completed.');
      }
    }, 3 * 60 * 1000);
  };

  const handleDownload = (url: string, i: number) => {
    const a = document.createElement('a');
    a.href = url; a.download = `indigo-image-${Date.now()}-${i}.png`;
    a.target = '_blank'; a.click();
  };

  const isGenerating = jobStatus === 'creating' || jobStatus === 'waiting';
  const ratios = isMJ(model) ? MJ_ASPECT_RATIOS : FLUX_ASPECT_RATIOS;

  const refWeightLabel = refType === 'style' ? 'Style Weight' : refType === 'character' ? 'Character Weight' : refType === 'omni' ? 'Omni Weight' : null;
  const refWeightVal   = refType === 'style' ? styleWeight : refType === 'character' ? charWeight : omniWeight;
  const refWeightMax   = refType === 'style' ? 1000 : refType === 'character' ? 100 : 2000;
  const setRefWeight   = refType === 'style' ? setStyleWeight : refType === 'character' ? setCharWeight : setOmniWeight;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Image Generator</h2>

      {!shortApiKey && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Add your ShortAPI key in Settings. Get one free at{' '}
          <a href="https://shortapi.ai" target="_blank" rel="noreferrer" className="underline font-medium">shortapi.ai</a>.
        </div>
      )}

      {/* Model selector */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Model</label>
        <div className="flex p-1 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <button onClick={() => handleModelChange('midjourney/midjourney-v7/image-to-image')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${!isMJ(model) ? 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600' : 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 shadow-sm'}`}>
            Midjourney v7
          </button>
          <button onClick={() => handleModelChange('shortapi/flux-1.0/image-to-image')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${isMJ(model) ? 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600' : 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 shadow-sm'}`}>
            FLUX 1.0
          </button>
        </div>
        {!isMJ(model) && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">FLUX requires a reference image to be enabled below.</p>
        )}
      </div>

      {/* Reference image */}
      {hasReference && (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <img src={aiProfile.referenceImage!} alt="Reference"
                className="w-10 h-10 rounded-lg object-cover border border-indigo-200 dark:border-indigo-700" />
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Use {aiProfile.name}'s reference image</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400">
                  {aiProfile.appearance ? 'Sends image + appearance description' : 'Reference image only'}
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
                  <span className="font-medium">Including: </span>
                  {aiProfile.appearance.slice(0, 120)}{aiProfile.appearance.length > 120 ? '…' : ''}
                </div>
              ) : (
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                  No appearance description — hair/eye/skin colors may not match. Add one in AI Profile → Appearance.
                </div>
              )}

              {/* MJ reference type */}
              {isMJ(model) && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300">How to use reference image</label>
                  <div className="space-y-1">
                    {REF_TYPES.map(t => (
                      <button key={t.value} onClick={() => setRefType(t.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${refType === t.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-800/50 text-indigo-900 dark:text-indigo-100' : 'border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:border-indigo-400'}`}>
                        <span className="font-medium">{t.label}</span>
                        <span className="ml-2 text-indigo-400">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                  {refType !== 'image' && refWeightLabel && (
                    <Slider label={refWeightLabel} value={refWeightVal} min={0} max={refWeightMax} onChange={setRefWeight} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!hasReference && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
          <User className="w-4 h-4 flex-shrink-0" />
          Add a reference image in AI Profile to guide the AI's output.
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Prompt</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder={`Describe the scene — e.g. "${aiProfile.name} standing in a rainy city at night, cinematic lighting"`}
          className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
      </div>

      {/* Aspect ratio + performance */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Aspect Ratio</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
            {ratios.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Quality</label>
          {isMJ(model) ? (
            <select value={mjPerf} onChange={e => setMjPerf(e.target.value as any)}
              className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
              <option value="speed">Speed</option>
              <option value="balance">Balance</option>
              <option value="quality">Quality</option>
            </select>
          ) : (
            <select value={fluxPerf} onChange={e => setFluxPerf(e.target.value as any)}
              className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
              <option value="schnell">Schnell (faster)</option>
              <option value="dev">Dev (better quality)</option>
            </select>
          )}
        </div>
      </div>

      {/* Advanced MJ settings */}
      {isMJ(model) && (
        <div>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 py-1">
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Advanced Midjourney Settings
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <div>
                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Negative Prompt</label>
                <input type="text" value={negPrompt} onChange={e => setNegPrompt(e.target.value)}
                  placeholder="What to avoid — e.g. blurry, low quality, cartoon"
                  className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <Slider label="Stylization (artistic style intensity)" value={stylization} min={0} max={1000} onChange={setStylization} />
              <Slider label="Chaos (variation / diversity)" value={chaos} min={0} max={100} onChange={setChaos} />
              <Slider label="Weirdness (creativity / uniqueness)" value={weirdness} min={0} max={3000} onChange={setWeirdness} />
              <p className="text-[10px] text-indigo-400 dark:text-indigo-500">Defaults: Stylization 100, Chaos 0, Weirdness 0</p>
            </div>
          )}
        </div>
      )}

      {/* Generate button */}
      <button onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || !shortApiKey}
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
          <li>Midjourney works with or without a reference image. FLUX always requires one.</li>
          <li>For best character consistency use <strong>Character ref</strong> mode — it locks appearance while letting you change the scene.</li>
          <li>Appearance description from the AI Profile is automatically added to your prompt when the reference toggle is on.</li>
          <li>Generated images are saved to your Gallery automatically.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGeneratorScreen;
