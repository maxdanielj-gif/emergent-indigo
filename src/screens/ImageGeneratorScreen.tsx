import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Download, RefreshCw, Image as ImageIcon, User, X } from 'lucide-react';

const MODELS = [
  { id: 'shortapi/flux-1.0/image-to-image', label: 'FLUX 1.0 — Fast, clean image-to-image' },
  { id: 'midjourney/midjourney-v7/image-to-image', label: 'Midjourney v7 — Artistic, highly detailed' },
];

const ASPECT_RATIOS = ['1:1', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2'];

const MJ_PERFORMANCE = [
  { value: 'speed',   label: 'Speed — Fastest' },
  { value: 'balance', label: 'Balance — Default' },
  { value: 'quality', label: 'Quality — Best' },
];

type JobStatus = 'idle' | 'creating' | 'waiting' | 'succeeded' | 'failed';

const ImageGeneratorScreen: React.FC = () => {
  const { shortApiKey, aiProfile, addToGallery, addToast } = useApp();

  const hasReference = !!aiProfile.referenceImage;

  const [useReference,  setUseReference]  = useState(hasReference);
  const [prompt,        setPrompt]        = useState('');
  const [negPrompt,     setNegPrompt]     = useState('');
  const [model,         setModel]         = useState(MODELS[0].id);
  const [aspectRatio,   setAspectRatio]   = useState('1:1');
  const [performance,   setPerformance]   = useState('balance');
  const [jobStatus,     setJobStatus]     = useState<JobStatus>('idle');
  const [statusMsg,     setStatusMsg]     = useState('');
  const [resultImages,  setResultImages]  = useState<string[]>([]);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isMJ = model === 'midjourney/midjourney-v7/image-to-image';

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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

    try {
      const body: any = {
        prompt: prompt.trim(),
        model,
        aspectRatio,
        performance,
        apiKey: shortApiKey,
        ...(negPrompt.trim() ? { negativePrompt: negPrompt.trim() } : {}),
        ...(useReference && aiProfile.referenceImage ? { inputImageBase64: aiProfile.referenceImage } : {}),
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

      const { jobId } = await res.json();
      setJobStatus('waiting');
      setStatusMsg('Generating — this usually takes 20–60 seconds…');
      startPolling(jobId);
    } catch (e: any) {
      setJobStatus('failed');
      setStatusMsg(e.message);
      addToast({ title: 'Generation failed', message: e.message, type: 'error' });
    }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/image/status/${jobId}?api_key=${encodeURIComponent(shortApiKey || '')}`);
        if (!res.ok) return; // keep trying

        const data = await res.json();

        if (data.status === 'succeeded') {
          clearInterval(pollRef.current!);
          pollRef.current = null;

          // Extract image URLs from result
          const urls: string[] = [];
          if (data.result?.images)    urls.push(...data.result.images.map((i: any) => i.url || i));
          if (data.result?.image_url) urls.push(data.result.image_url);
          if (data.result?.url)       urls.push(data.result.url);
          if (typeof data.result === 'string') urls.push(data.result);

          if (urls.length === 0) {
            // Try to find any URL in the result
            const resultStr = JSON.stringify(data.result || {});
            const urlMatch = resultStr.match(/https?:\/\/[^\s"]+\.(jpg|jpeg|png|webp)/i);
            if (urlMatch) urls.push(urlMatch[0]);
          }

          if (urls.length > 0) {
            setResultImages(urls);
            setJobStatus('succeeded');
            setStatusMsg('');
            urls.forEach((url, i) => {
              addToGallery({
                id: `generated-${Date.now()}-${i}`,
                type: 'generated',
                mediaType: 'image',
                url,
                prompt: prompt.trim(),
                timestamp: Date.now(),
              });
            });
            addToast({ title: 'Done!', message: `${urls.length} image${urls.length > 1 ? 's' : ''} saved to gallery.`, type: 'success' });
          } else {
            setJobStatus('failed');
            setStatusMsg('Job succeeded but no image URL found in response.');
          }
        } else if (data.status === 'failed' || data.status === 'error') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setJobStatus('failed');
          setStatusMsg(data.error || data.message || 'Generation failed.');
          addToast({ title: 'Failed', message: data.error || 'Generation failed.', type: 'error' });
        }
        // otherwise keep polling (pending/processing)
      } catch {}
    }, 3000);

    // Stop polling after 3 minutes
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        if (jobStatus === 'waiting') {
          setJobStatus('failed');
          setStatusMsg('Timed out after 3 minutes. The job may still complete — check your gallery later.');
        }
      }
    }, 3 * 60 * 1000);
  };

  const handleDownload = (url: string, i: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `indigo-image-${Date.now()}-${i}.png`;
    a.target = '_blank';
    a.click();
  };

  const isGenerating = jobStatus === 'creating' || jobStatus === 'waiting';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Image Generator</h2>

      {!shortApiKey && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Add your ShortAPI key in Settings to enable image generation. Get one free at{' '}
          <a href="https://shortapi.ai" target="_blank" rel="noreferrer" className="underline font-medium">shortapi.ai</a>.
        </div>
      )}

      {/* Reference image toggle */}
      {hasReference && (
        <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <img src={aiProfile.referenceImage!} alt="Reference"
              className="w-10 h-10 rounded-lg object-cover border border-indigo-200 dark:border-indigo-700" />
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Use {aiProfile.name}'s reference image</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400">Guides the AI to match the persona's appearance</p>
            </div>
          </div>
          <button onClick={() => setUseReference(!useReference)}
            className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${useReference ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${useReference ? 'translate-x-2' : '-translate-x-2'}`} />
          </button>
        </div>
      )}

      {!hasReference && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
          <User className="w-4 h-4 flex-shrink-0" />
          Add a reference image to {aiProfile.name}'s profile to guide the AI's output.
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Prompt</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
          placeholder={`Describe the image — e.g. "${aiProfile.name} standing in a rainy city at night, cinematic lighting"`}
          className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
      </div>

      {/* Negative prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
          Negative Prompt <span className="font-normal text-indigo-400">(optional)</span>
        </label>
        <input type="text" value={negPrompt} onChange={(e) => setNegPrompt(e.target.value)}
          placeholder="e.g. blurry, low quality, cartoon"
          className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      {/* Model, Aspect Ratio, Performance */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Aspect Ratio</label>
          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
            {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
            {isMJ ? 'Quality' : 'Performance'}
          </label>
          <select value={performance} onChange={(e) => setPerformance(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm">
            {isMJ
              ? MJ_PERFORMANCE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)
              : <>
                  <option value="schnell">Schnell — Faster</option>
                  <option value="dev">Dev — Higher quality</option>
                </>
            }
          </select>
        </div>
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim() || !shortApiKey}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {isGenerating
          ? <><RefreshCw className="w-4 h-4 animate-spin" /> {statusMsg || 'Generating…'}</>
          : <><ImageIcon className="w-4 h-4" /> Generate Image</>}
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
          <li>Generation takes 20–60 seconds. The page will update automatically when done.</li>
          <li>FLUX is better for realistic, photo-style images. Midjourney excels at artistic and stylized results.</li>
          <li>When using the reference image, describe what you want to happen or change, not the whole scene.</li>
          <li>All generated images are saved to your Gallery automatically.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGeneratorScreen;
