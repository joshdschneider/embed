import crypto from 'crypto';
import ms from 'ms';
import { DEFAULT_ERROR_MESSAGE } from './constants';
import { Resource } from './enums';

export function generateId(prefix: Resource, byteLength = 8): string {
  return `${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function unixToDate(unixTimestamp: number): Date {
  return new Date(unixTimestamp * 1000);
}

export function getFrequencyInterval(
  frequency: string,
  date: Date
):
  | { interval: string; offset: number; error: null }
  | { interval: null; offset: null; error: string } {
  try {
    if (!ms(frequency)) {
      throw new Error('Invalid sync interval');
    } else if (ms(frequency) < ms('5m')) {
      throw new Error('Sync interval is too short');
    }

    const intervalMs = ms(frequency);
    const nowMs = date.getMinutes() * 60 * 1000 + date.getSeconds() * 1000 + date.getMilliseconds();
    const offset = nowMs % intervalMs;

    if (isNaN(offset)) {
      throw new Error('Invalid sync interval');
    }

    return { interval: frequency, offset: offset, error: null };
  } catch (err) {
    let error = DEFAULT_ERROR_MESSAGE;

    if (err instanceof Error) {
      error = err.message;
    }

    return { interval: null, offset: null, error };
  }
}
