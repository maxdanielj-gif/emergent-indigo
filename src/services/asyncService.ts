export interface AsyncVoice {
  voice_id: string;
  name: string;
  description: string;
  language: string;
  gender: 'Male' | 'Female' | 'Neutral' | 'Unspecified';
  accent: string;
  style: string;
  created_at: string;
  updated_at: string;
  voice_type: 'PREDEFINED' | 'CUSTOM';
}

export const generateAsyncSpeech = async (text: string, voiceId: string, apiKey?: string | null): Promise<Blob> => {
  const res = await fetch('/api/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, apiKey: apiKey || undefined }),
  });

  if (!res.ok) {
    let errMsg = `TTS request failed (${res.status})`;
    try {
      const err = await res.json();
      errMsg = err.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return await res.blob();
};

export interface CloneVoiceOptions {
  name: string;
  description?: string;
  accent?: string;
  gender?: 'Male' | 'Female' | 'Neutral' | 'Unspecified';
  style?: string;
  transcript?: string;
  enhance?: boolean;
}

export const cloneAsyncVoice = async (
  audioFile: File | Blob,
  options: CloneVoiceOptions,
  apiKey?: string | null
): Promise<{ id: string; name: string }> => {
  if (!apiKey) throw new Error("Async API key not set. Add it in Settings.");

  // Convert audio to base64 to send through our JSON proxy endpoint
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioFile);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip the data:...;base64, prefix
    };
    reader.onerror = reject;
  });

  const mimeType = audioFile instanceof File ? audioFile.type : "audio/wav";
  const fileName = audioFile instanceof File ? audioFile.name : "recording.wav";

  const res = await fetch("/api/voices/clone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64: base64,
      audioMimeType: mimeType,
      audioFileName: fileName,
      apiKey,
      ...options,
    }),
  });

  if (!res.ok) {
    let errMsg = `Clone failed (${res.status})`;
    try { const err = await res.json(); errMsg = err.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return await res.json();
};

export const listAsyncVoices = async (params: any = {}, apiKey?: string | null): Promise<AsyncVoice[]> => {
  if (!apiKey) throw new Error("Async API key not set. Add it in Settings.");

  const response = await fetch('/api/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, apiKey }),
  });

  if (!response.ok) {
    let errMsg = `Failed to fetch voices (${response.status})`;
    try { const err = await response.json(); errMsg = err.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.voices || [];
};

export const getAsyncVoice = async (voiceId: string, apiKey?: string | null): Promise<AsyncVoice> => {
  const url = `/api/voices/${voiceId}${apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voice details: ${response.statusText}`);
  }

  return await response.json();
};

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

export interface ElevenLabsVoiceParams {
  search?: string;
  sort?: 'name' | 'created_at_unix';
  sort_direction?: 'asc' | 'desc';
  voice_type?: 'personal' | 'community' | 'default' | 'non-default';
  category?: 'premade' | 'cloned' | 'generated' | 'professional';
}

export const generateElevenLabsSpeech = async (
  text: string,
  voiceId: string,
  apiKey?: string | null
): Promise<Blob> => {
  if (!apiKey) throw new Error("ElevenLabs API key not set. Add it in Settings.");

  const res = await fetch('/api/tts/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, apiKey }),
  });

  if (!res.ok) {
    let errMsg = `ElevenLabs TTS failed (${res.status})`;
    try { const err = await res.json(); errMsg = err.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return await res.blob();
};

export const listElevenLabsVoices = async (
  apiKey?: string | null,
  params: ElevenLabsVoiceParams = {}
): Promise<ElevenLabsVoice[]> => {
  if (!apiKey) throw new Error("ElevenLabs API key not set. Add it in Settings.");

  const qs = new URLSearchParams({ api_key: apiKey });
  if (params.search)         qs.set('search',         params.search);
  if (params.sort)           qs.set('sort',           params.sort);
  if (params.sort_direction) qs.set('sort_direction', params.sort_direction);
  if (params.voice_type)     qs.set('voice_type',     params.voice_type);
  if (params.category)       qs.set('category',       params.category);

  const res = await fetch(`/api/tts/elevenlabs/voices?${qs.toString()}`);
  if (!res.ok) {
    let errMsg = `Failed to fetch ElevenLabs voices (${res.status})`;
    try { const err = await res.json(); errMsg = err.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.voices || [];
};
