// Gemini has been removed. These helpers are kept so old import statements
// don't crash during incremental cleanup.
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try { return await fn(); }
  catch (e: any) {
    if (retries > 0) { await sleep(delay); return retry(fn, retries - 1, delay * 1.5); }
    throw e;
  }
};

export const sendMessage = async (..._args: any[]) => {
  throw new Error('Gemini removed. Use Claude via /api/chat instead.');
};
