import { createClient } from '@deepgram/sdk';
import dotenv from 'dotenv';
dotenv.config();

export function getDeepgramApiKey() {
  const apiKey = process.env['DEEPGRAM_API_KEY'];
  if (!apiKey) {
    throw new Error('Deepgram API key not set');
  }

  return apiKey;
}

const deepgram = createClient(getDeepgramApiKey());
