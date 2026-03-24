import React from 'react';
import { ImageOff, Sparkles } from 'lucide-react';

/**
 * Image Generator — Coming Soon
 *
 * Image-to-image generation (using the AI persona's reference image as base)
 * is planned for a future update. The screen exists so the nav link still works.
 */
const ImageGeneratorScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
    <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900
                    flex items-center justify-center mb-6">
      <ImageOff className="w-10 h-10 text-indigo-400 dark:text-indigo-500" />
    </div>

    <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-3">
      Image Generation
    </h2>

    <p className="text-indigo-600 dark:text-indigo-300 max-w-sm leading-relaxed mb-6">
      Coming soon — this feature will let you generate images of your AI persona
      using your reference photo as the base, so the character always looks consistent.
    </p>

    <div className="flex items-center gap-2 px-4 py-2 rounded-full
                    bg-indigo-100 dark:bg-indigo-900
                    text-indigo-500 dark:text-indigo-400
                    text-sm font-medium">
      <Sparkles className="w-4 h-4" />
      <span>Image-to-image support planned</span>
    </div>
  </div>
);

export default ImageGeneratorScreen;
