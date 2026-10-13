export class GeminiHttpError extends Error {
  constructor(status, message, retryAfter = null) {
    super(`Gemini ${status}: ${message}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const transient = status => status === 408 || status === 429 || status >= 500 && status <= 599;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Retry only transient responses. A 503 can use a second compatible model.
export async function withGeminiRetry(send, payload, options = {}) {
  const { onRetry = () => {}, sleep = pause, random = Math.random } = options;
  const fallback = payload.model === 'gemini-3.8-flash' ? 'gemini-3.6-flash'
    : payload.model === 'gemini-3.8-flash-tts' ? 'gemini-3.8-flash-lite-tts' : null;
  let model = payload.model;
  for (let group = 0; group < (fallback ? 2 : 1); group++) {
    const maxAttempts = group === 0 ? 4 : 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try { return await send({ ...payload, model }); }
      catch (error) {
        if (!transient(error.status)) throw error;
        if (attempt === maxAttempts) {
          if (error.status === 503 && group === 0 && fallback) {
            model = fallback;
            onRetry({ model, attempt: 1, maxAttempts: 2, fallback: true, waitMs: 0 });
            break;
          }
          throw error;
        }
        const backoff = Math.min(15000, 1500 * 2 ** (attempt - 1)) * (0.8 + random() * 0.4);
        const waitMs = Math.min(30000, Math.max(backoff, error.retryAfter ?? 0));
        onRetry({ model, attempt: attempt + 1, maxAttempts, fallback: group > 0, waitMs });
        await sleep(waitMs);
      }
    }
  }
  throw new Error('Gemini agotó los reintentos');
}
