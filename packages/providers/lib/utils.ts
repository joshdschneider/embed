import { createClient } from '@deepgram/sdk';

export function getDeepgramInstance() {
  const apiKey = process.env['DEEPGRAM_API_KEY'];
  if (!apiKey) {
    throw new Error('Deepgram API key not set');
  }

  return createClient(apiKey);
}
