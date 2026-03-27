import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, RefreshCw, Image as ImageIcon, User } from 'lucide-react';

const TXT2IMG_MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell',              label: 'FLUX.1 Schnell — Fast (recommended)' },
  { id: 'black-forest-labs/FLUX.1-dev',                  label: 'FLUX.1 Dev — Higher quality' },
  { id: 'black-forest-labs/FLUX.1-Krea-dev',             label: 'FLUX.1 Krea Dev — Realistic' },
  { id: 'ByteDance/SDXL-Lightning',                      label: 'SDXL Lightning — Fast & stylized' },
];

const IMG2IMG_MODELS = [
  { id: 'meituan-longcat/LongCat-Image-Edit',            label: 'LongCat Image Edit — Instruction-based (recommended)' },
  { id: 'black-forest-labs/FLUX.1-Krea-dev',             label: 'FLUX.1 Krea Dev — Style transfer' },
];

const SIZES = [
  { label: 'Square (1024×1024)',  width: 1024, height: 1024 },
  { label: 'Portrait (768×1024)', width: 768,  height: 1024 },
  { label: 'Landscape (1024×768)',width: 1024, height: 768  },
  { label: 'Wide (1280×720)',     width: 1280, height: 720  },
];

const ImageGeneratorScreen: React.FC = () => {
  const { huggingFaceApiKey, aiProfile, addToGallery, addToast } = useApp();

  const hasReference = !!aiProfile.referenceImage;

  const [useReference,   setUseReference]   = useState(hasReference);
  const [prompt,         setPrompt]         = useState('');
  const [negPrompt,      setNegPrompt]      = useState('');
  const [model,          setModel]          = useState(hasReference ? IMG2IMG_MODELS[0].id : TXT2IMG_MODELS[0].id);
  const [sizeIdx,        setSizeIdx]        = useState(0);
  const [strength,       setStrength]       = useState(0.75);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [resultImage,    setResultImage]    = useState<string | null>(null);

  const isImg2Img = useReference && hasReference;
  const models    = isImg2Img ? IMG2IMG_MODELS : TXT2IMG_MODELS;

  // Switch to appropriate default model when toggling mode
  const handleToggleReference = (val: boolean) => {
    setUseReference(val);
    setModel(val ? IMG2IMG_MODELS[0].id : TXT2IMG_MODELS[0].id);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ title: 'Prompt required', message: 'Describe the image you want.', type: 'warning' });
      return;
    }
    if (!huggingFaceApiKey) {
      addToast({ title: 'No API token', message: 'Add your HuggingFace token in Settings first.', type: 'warning' });
      return;
    }

    setIsGenerating(true);
    setResultImage(null);
    addToast({ title: 'Generating', message: isImg2Img ? 'Sending reference image + prompt…' : 'Sending to FLUX…', type: 'info' });

    try {
      const { width, height } = SIZES[sizeIdx];

      const body: any = {
        prompt: prompt.trim(),
        model,
        negativePrompt: negPrompt.trim() || undefined,
        apiKey: huggingFaceApiKey,
      };

      if (isImg2Img && aiProfile.referenceImage) {
        body.inputImageBase64 = aiProfile.referenceImage;
        body.strength = strength;
      } else {
        body.width  = width;
        body.height = height;
      }

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const { image, mimeType } = await res.json();
      const dataUrl = `data:${mimeType};base64,${image}`;
      setResultImage(dataUrl);

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

      {/* Reference image toggle */}
      {hasReference && (
        <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <img
              src={aiProfile.referenceImage!}
              alt="Reference"
              className="w-10 h-10 rounded-lg object-cover border border-indigo-200 dark:border-indigo-700"
            />
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Use {aiProfile.name}'s reference image</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400">Image-to-image mode — keeps the persona's likeness</p>
            </div>
          </div>
          <button
            onClick={() => handleToggleReference(!useReference)}
            className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${useReference ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${useReference ? 'translate-x-2' : '-translate-x-2'}`} />
          </button>
        </div>
      )}

      {!hasReference && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
          <User className="w-4 h-4 flex-shrink-0" />
          Add a reference image to {aiProfile.name}'s profile to enable image-to-image mode.
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
          {isImg2Img ? 'Edit instruction' : 'Prompt'}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={isImg2Img
            ? `e.g. "Make ${aiProfile.name} look like they're sitting by a campfire at night"`
            : `e.g. "${aiProfile.name} at sunset, soft lighting, photorealistic portrait"`}
          className="w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        />
      </div>

      {/* Negative prompt */}
      <div>
        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
          Negative Prompt <span className="font-normal text-indigo-400">(optional)</span>
        </label>
        <input
          type="text"
          value={negPrompt}
          onChange={(e) => setNegPrompt(e.target.value)}
          placeholder="e.g. blurry, low quality, extra limbs"
          className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Model + Size / Strength */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        {isImg2Img ? (
          <div>
            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
              Strength: {strength.toFixed(2)}
            </label>
            <div className="relative w-full h-6 flex items-center mt-1">
              <div className="absolute w-full h-2 bg-indigo-200 dark:bg-indigo-700 rounded-full" />
              <div
                className="absolute h-2 bg-indigo-600 rounded-full"
                style={{ width: `${((strength - 0.1) / 0.9) * 100}%` }}
              />
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                className="absolute w-full opacity-0 cursor-pointer h-6"
              />
              <div
                className="absolute w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow pointer-events-none"
                style={{ left: `calc(${((strength - 0.1) / 0.9) * 100}% - 10px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-indigo-400 mt-1">
              <span>Keep likeness</span><span>More creative</span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Size</label>
            <select
              value={sizeIdx}
              onChange={(e) => setSizeIdx(Number(e.target.value))}
              className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs"
            >
              {SIZES.map((s, i) => (
                <option key={i} value={i}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Generate */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || !huggingFaceApiKey}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isGenerating
          ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
          : <><ImageIcon className="w-4 h-4" /> Generate Image</>}
      </button>

      {/* Result */}
      {resultImage && (
        <div className="space-y-3">
          <img src={resultImage} alt={prompt} className="w-full rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-lg" />
          <div className="flex gap-2">
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-2 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={() => { setResultImage(null); setPrompt(''); }} className="flex-1 flex items-center justify-center gap-2 py-2 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors">
              New Image
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Tips</p>
        <ul className="text-xs text-indigo-500 dark:text-indigo-400 space-y-1">
          {isImg2Img ? (
            <>
              <li>Lower strength (0.4–0.6) keeps the reference image closer. Higher (0.8+) allows more creative changes.</li>
              <li>LongCat Image Edit is instruction-based — describe what you want to change, not the full scene.</li>
              <li>All models run via fal.ai through your HuggingFace token.</li>
            </>
          ) : (
            <>
              <li>FLUX Schnell is the fastest option. FLUX Dev and Krea produce higher quality results.</li>
              <li>All models run via fal.ai using your HuggingFace token's monthly credits ($2 free/month on Pro).</li>
            </>
          )}
          <li>Generated images are automatically saved to your Gallery.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGeneratorScreen;
