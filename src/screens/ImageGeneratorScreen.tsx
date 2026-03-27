import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Download, RefreshCw, Image as ImageIcon, User, X } from 'lucide-react';

// Aspect ratio presets — img2img needs smaller pixels, txt2img needs larger
const ASPECT_RATIOS = [
  { label: 'Square (1:1)',    value: '1:1'  },
  { label: 'Portrait (3:4)', value: '3:4'  },
  { label: 'Landscape (4:3)',value: '4:3'  },
  { label: 'Tall (9:16)',    value: '9:16' },
  { label: 'Wide (16:9)',    value: '16:9' },
];

type JobStatus = 'idle' | 'creating' | 'waiting' | 'succeeded' | 'failed';

const ImageGeneratorScreen: React.FC = () => {
  const { shortApiKey, aiProfile, addToGallery, addToast } = useApp();

  const hasReference = !!aiProfile.referenceImage;

  const [useReference,  setUseReference]  = useState(hasReference);
  const [prompt,        setPrompt]        = useState('');
  const [negPrompt,     setNegPrompt]     = useState('');
  const [aspectRatio,   setAspectRatio]   = useState('1:1');
  const [numImages,     setNumImages]     = useState(1);
  const [promptExtend,  setPromptExtend]  = useState(false);
  const [jobStatus,     setJobStatus]     = useState<JobStatus>('idle');
  const [statusMsg,     setStatusMsg]     = useState('');
  const [resultImages,  setResultImages]  = useState<string[]>([]);

  const pollRef        = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef     = useRef<NodeJS.Timeout | null>(null);
  const promptRef      = useRef('');

  useEffect(() => () => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ title: 'Prompt required', message: 'Describe the image you want.', type: 'warning' });
      return;
    }
    if (!shortApiKey) {
      addToast({ title: 'No ShortAPI key', message: 'Add your ShortAPI key in Settings first.', type: 'warning' });
      return;
    }

    setJobStatus('creating');
    setStatusMsg('Creating job…');
    setResultImages([]);

    const hasRef = useReference && hasReference;

    // Prepend appearance description when reference is used so colors are correct
    const appearance = aiProfile.appearance?.trim();
    let finalPrompt = prompt.trim();
    if (hasRef && appearance) {
      finalPrompt = `${appearance}. ${finalPrompt}`;
    }
    promptRef.current = finalPrompt;

    try {
      const body: any = {
        prompt:      finalPrompt,
        aspectRatio,
        numImages,
        promptExtend,
        apiKey:      shortApiKey,
        ...(negPrompt.trim() ? { negativePrompt: negPrompt.trim() } : {}),
        ...(hasRef            ? { inputImageBase64: aiProfile.referenceImage } : {}),
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

      const { jobId, model } = await res.json();
      const modelLabel = model?.includes('text-to-image') ? 'WAN 2.6 Text-to-Image' : 'WAN 2.6 Image-to-Image';
      setJobStatus('waiting');
      setStatusMsg(`Generating with ${modelLabel}…`);
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

        if (['succeeded', 'completed', 'success'].includes(status)) {
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
            setStatusMsg(`Job succeeded but no image found. Raw: ${JSON.stringify(data.result ?? data.output ?? '').slice(0, 200)}`);
          }
        } else if (['failed', 'error', 'cancelled'].includes(status)) {
          clearInterval(pollRef.current!);
          clearTimeout(timeoutRef.current!);
          pollRef.current = null;
          const msg = data.error || data.message || data.reason || 'Generation failed.';
          setJobStatus('failed');
          setStatusMsg(msg);
          addToast({ title: 'Failed', message: msg, type: 'error' });
        }
        // pending / processing / queued / running → keep polling
      } catch {}
    }, 3000);

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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Image Generator</h2>
        <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">Powered by Alibaba WAN 2.6</p>
      </div>

      {!shortApiKey && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Add your ShortAPI key in Settings. Get one free at{' '}
          <a href="https://shortapi.ai" target="_blank" rel="noreferrer" className="underline font-medium">shortapi.ai</a>.
        </div>
      )}

      {/* Reference image toggle */}
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
                  {useReference
                    ? aiProfile.appearance ? 'Image + appearance description sent' : 'Image sent (no appearance description)'
                    : 'Text-to-image mode'}
                </p>
              </div>
            </div>
            <button onClick={() => setUseReference(!useReference)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${useReference ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${useReference ? 'translate-x-2' : '-translate-x-2'}`} />
            </button>
          </div>
          {useReference && !aiProfile.appearance && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
              No appearance description set — hair/eye/skin colors may not match. Add one in AI Profile → Appearance.
            </div>
          )}
          {useReference && aiProfile.appearance && (
            <div className="px-3 py-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg text-xs text-indigo-600 dark:text-indigo-300">
              <span className="font-medium">Including: </span>
              {aiProfile.appearance.slice(0, 120)}{aiProfile.appearance.length > 120 ? '…' : ''}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
          <User className="w-4 h-4 flex-shrink-0" />
          Add a reference image in AI Profile for image-to-image mode (better character consistency).
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Prompt</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder={`Describe the scene — e.g. "${aiProfile.name} walking through a sunlit forest, cinematic photography"`}
          className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
      </div>

      {/* Negative prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
          Negative Prompt <span className="font-normal text-indigo-400">(optional)</span>
        </label>
        <input type="text" value={negPrompt} onChange={e => setNegPrompt(e.target.value)}
          placeholder="e.g. blurry, low quality, distorted face"
          className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Aspect Ratio</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
            {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Number of Images</label>
          <select value={numImages} onChange={e => setNumImages(Number(e.target.value))}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
            <option value={1}>1 image</option>
            <option value={2}>2 images</option>
            <option value={3}>3 images</option>
            <option value={4}>4 images</option>
          </select>
        </div>
      </div>

      {/* Prompt extend toggle */}
      <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <div>
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Intelligent Prompt Rewriting</p>
          <p className="text-xs text-indigo-400 dark:text-indigo-500">AI expands your prompt for better results</p>
        </div>
        <button onClick={() => setPromptExtend(!promptExtend)}
          className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${promptExtend ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${promptExtend ? 'translate-x-2' : '-translate-x-2'}`} />
        </button>
      </div>

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
                className="w-full rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-lg"
                onError={(e) => { (e.target as HTMLImageElement).alt = 'Image failed to load'; }} />
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
          <li>With the reference image on, WAN 2.6 is designed to preserve the character's identity — face, hair, skin tone.</li>
          <li>Add an appearance description in AI Profile for the most accurate color matching.</li>
          <li>"Intelligent Prompt Rewriting" can help if your prompt is short or vague.</li>
          <li>Generation takes 30–90 seconds. All images save to your Gallery automatically.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGeneratorScreen;
