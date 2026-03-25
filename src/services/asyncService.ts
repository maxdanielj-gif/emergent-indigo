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

export const listAsyncVoices = async (params: any = {}, apiKey?: string | null): Promise<AsyncVoice[]> => {
  const response = await fetch('/api/voices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...params, apiKey }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.statusText}`);
  }

  const data = await response.json();
  return data.voices;
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
