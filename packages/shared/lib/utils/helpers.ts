import crypto from 'crypto';
import ms, { StringValue } from 'ms';
import { Resource, SyncFrequency } from './enums';

export function generateId(prefix: Resource, byteLength = 8): string {
  return `${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function unixToDate(unixTimestamp: number): Date {
  return new Date(unixTimestamp * 1000);
}

export function getIntervalFromFrequency(frequency: SyncFrequency): StringValue {
  switch (frequency) {
    case SyncFrequency.RealTime:
      return '1d'; // fallback with daily sync
    case SyncFrequency.Hourly:
      return '1h';
    case SyncFrequency.Daily:
      return '1d';
    case SyncFrequency.Weekly:
      return '1w';
    case SyncFrequency.Monthly:
      return '4w';
    default:
      throw new Error('Invalid sync interval');
  }
}

export function getFrequencyInterval(
  frequency: SyncFrequency,
  date: Date
): { interval: StringValue; offset: number } {
  const nowMs = date.getMinutes() * 60 * 1000 + date.getSeconds() * 1000 + date.getMilliseconds();
  const interval = getIntervalFromFrequency(frequency);
  const intervalMs = ms(interval);
  const offset = nowMs % intervalMs;
  if (isNaN(offset)) {
    throw new Error('Invalid sync interval');
  }

  return { interval, offset };
}

export function interpolateIfNeeded(str: string, replacers: Record<string, any>) {
  if (str.includes('${')) {
    return interpolateStringFromObject(str, replacers);
  } else {
    return str;
  }
}

export function interpolateStringFromObject(str: string, replacers: Record<string, any>) {
  return str.replace(/\${([^{}]*)}/g, (a, b) => {
    const r = b.split('.').reduce((o: Record<string, any>, i: string) => o[i], replacers);
    return typeof r === 'string' || typeof r === 'number' ? (r as string) : a;
  });
}

export function interpolateString(str: string, replacers: Record<string, any>) {
  return str.replace(/\${([^{}]*)}/g, (a, b) => {
    const r = replacers[b];
    return typeof r === 'string' || typeof r === 'number' ? (r as string) : a;
  });
}

export function missesInterpolationParam(str: string, replacers: Record<string, any>) {
  const strWithoutConfig = str.replace(/configuration\./g, '');
  const interpolatedStr = interpolateString(strWithoutConfig, replacers);
  return /\${([^{}]*)}/g.test(interpolatedStr);
}

export function generateWebhookSigningSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getWebhookSignatureHeader(
  payload: string,
  secret: string
): { 'X-Embed-Signature': string } {
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return { 'X-Embed-Signature': `sha256=${hash}` };
}

export function deconstructObject(
  obj: Record<string, any>,
  parentKey = '',
  result: [string, any][] = []
): [string, any][] {
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const newKey = parentKey ? `${parentKey}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      deconstructObject(value, newKey, result);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          deconstructObject(item, `${newKey}.${index}`, result);
        } else {
          result.push([`${newKey}.${index}`, item]);
        }
      });
    } else {
      result.push([newKey, value]);
    }
  });

  return result;
}

export function reconstructObject(entries: [string, any][]): Record<string, any> {
  const result: Record<string, any> = {};

  entries.forEach(([path, value]) => {
    const keys = path.split('.');
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key === undefined) {
        continue;
      }

      const nextKeyIsIndex = !isNaN(Number(keys[i + 1]));
      if (nextKeyIsIndex && current[key] === undefined) {
        current[key] = [];
      } else if (!nextKeyIsIndex && current[key] === undefined) {
        current[key] = {};
      }

      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey !== undefined) {
      if (!isNaN(Number(lastKey))) {
        const index = parseInt(lastKey, 10);
        if (Array.isArray(current)) {
          current[index] = value;
        } else {
          current[lastKey] = value;
        }
      } else {
        current[lastKey] = value;
      }
    }
  });

  return result;
}

export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

export function countWords(input: string): number {
  const trimmedInput = input.trim();
  if (trimmedInput === '') {
    return 0;
  }

  const wordsArray = trimmedInput.split(/\s+/);
  return wordsArray.length;
}

function truncateString(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function truncateDeep(obj: any, maxLength: number): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateDeep(item, maxLength));
  }

  const truncatedObject: any = {};
  for (const key in obj) {
    if (key.endsWith('_vector')) {
      delete obj[key];
    }

    const value = obj[key];
    if (typeof value === 'string') {
      truncatedObject[key] = truncateString(value, maxLength);
    } else {
      truncatedObject[key] = truncateDeep(value, maxLength);
    }
  }
  return truncatedObject;
}

export function logObjects(objects: any[], maxLength: number = 40): string[] {
  return objects.map((obj) => truncateDeep(obj, maxLength));
}
