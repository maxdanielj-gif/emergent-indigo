import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, RefreshCw, Image as ImageIcon } from 'lucide-react';

const MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell (Fast, free)' },
  { id: 'black-forest-labs/FLUX.1-dev',     label: 'FLUX.1 Dev (Higher quality)' },
  { id: 'stabilityai/stable-diffusion-3.5-large', label: 'Stable Diffusion 3.5 Large' },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'Stable Diffusion XL' },
];

const SIZES = [
  { label: 'Square (1024×1024)', width: 1024, height: 1024 },
  { label: 'Portrait (768×1024)', width: 768,  height: 1024 },
  { label: 'Landscape (1024×768)', width: 1024, height: 768  },
  { label: 'Wide (1280×720)',     width: 1280, height: 720   },
];

const ImageGeneratorScreen: React.FC = () => {
  const { huggingFaceApiKey, aiProfile, addToGallery, addToast } = useApp();

  const [prompt,         setPrompt]         = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model,          setModel]          = useState(MODELS[0].id);
  const [sizeIdx,        setSizeIdx]        = useState(0);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [resultImage,    setResultImage]    = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ title: 'Prompt required', message: 'Describe the image you want to generate.', type: 'warning' });
      return;
    }
    if (!huggingFaceApiKey) {
      addToast({ title: 'No API token', message: 'Add your HuggingFace token in Settings first.', type: 'warning' });
      return;
    }

    setIsGenerating(true);
    setResultImage(null);
    addToast({ title: 'Generating', message: 'Sending to FLUX… this may take 10–30 seconds.', type: 'info' });

    try {
      const { width, height } = SIZES[sizeIdx];
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          model,
          width,
          height,
          apiKey: huggingFaceApiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const { image, mimeType } = await res.json();
      const dataUrl = `data:${mimeType};base64,${image}`;
      setResultImage(dataUrl);

      // Auto-save to gallery
      addToGallery({
        id: `generated-${Date.now()}`,
        type: 'generated',
        mediaType: 'image',
        url: dataUrl,
        prompt: prompt.trim(),
        timestamp: Date.now(),
      });

      addToast({ title: 'Done!', message: 'Image saved to gallery.', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Generation failed', message: e.message, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `indigo-image-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Image Generator</h2>

      {!huggingFaceApiKey && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          Add your HuggingFace token in Settings to enable image generation.
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={`Describe the image you want. For example: "${aiProfile.name} sitting by a window at sunset, soft lighting, photorealistic"`}
          className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        />
      </div>

      {/* Negative prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
          Negative Prompt <span className="font-normal text-indigo-400">(optional — what to avoid)</span>
        </label>
        <input
          type="text"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="e.g. blurry, low quality, extra limbs"
          className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Model + Size */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Size</label>
          <select
            value={sizeIdx}
            onChange={(e) => setSizeIdx(Number(e.target.value))}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm"
          >
            {SIZES.map((s, i) => (
              <option key={i} value={i}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || !huggingFaceApiKey}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isGenerating
          ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
          : <><ImageIcon className="w-4 h-4" /> Generate Image</>
        }
      </button>

      {/* Result */}
      {resultImage && (
        <div className="space-y-3">
          <img
            src={resultImage}
            alt={prompt}
            className="w-full rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-lg"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={() => { setResultImage(null); setPrompt(''); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors"
            >
              New Image
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Tips</p>
        <ul className="text-xs text-indigo-500 dark:text-indigo-400 space-y-1">
          <li>FLUX Schnell is fastest (free tier, ~10s). FLUX Dev is higher quality but slower.</li>
          <li>If you get a "model loading" error, wait 30 seconds and try again.</li>
          <li>Generated images are automatically saved to your Gallery.</li>
          <li>Be descriptive — lighting, style, and mood words make a big difference.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGeneratorScreen;
