import { EnvironmentType, getServerUrl } from '@embed/shared';
import crypto from 'crypto';
import { ZodError } from 'zod';

export function getOauthCallbackUrl() {
  const serverUrl = getServerUrl();
  if (!serverUrl) {
    throw new Error('Server URL is not set');
  }

  return serverUrl + '/oauth/callback';
}

export function extractConfigurationKeys(url: string): string[] {
  const configurationRegex = /\$\{configuration\.([^}]+)\}/g;
  return Array.from(url.matchAll(configurationRegex))
    .map((match) => match[1])
    .filter((key): key is string => key !== undefined);
}

export function formatKeyToReadableText(key: string): string {
  const words = key.replace(/[_-]/g, ' ').split(' ');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export function appendParamsToUrl(url: string, params: Record<string, string>) {
  const baseUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    baseUrl.searchParams.set(key, value);
  });
  return baseUrl.toString();
}

export function generateSecretKey(environment: EnvironmentType, byteLength = 16): string {
  const prefix = environment === EnvironmentType.Staging ? 'test' : 'prod';
  return `sk_${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function zodError(err: ZodError) {
  return err.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ');
}
