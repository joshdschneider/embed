import crypto from 'crypto';
import type { Response } from 'express';
import { EnvironmentType } from '../types';
import { getLocalhostUrl, getServerUrl } from './constants';

export function getOauthCallbackUrl() {
  const baseUrl = getServerUrl() || getLocalhostUrl();
  return baseUrl + '/oauth/callback';
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

export function interpolateString(str: string, replacers: Record<string, any>) {
  return str.replace(/\${([^{}]*)}/g, (a, b) => {
    const r = replacers[b];
    return typeof r === 'string' || typeof r === 'number' ? (r as string) : a;
  });
}
export function closeWindow(res: Response) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader('Content-Security-Policy', `script-src 'nonce-${nonce}'`);
  res.render('close', { nonce });
}

export function generateSecretKey(environment: EnvironmentType, byteLength = 16): string {
  const prefix = environment === EnvironmentType.Staging ? 'test' : 'prod';
  return `sk_${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function generateSecret(byteLength = 16): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export enum Resource {
  Account = 'acc',
  ApiKey = 'key',
  Environment = 'env',
  ActivityLog = 'log',
  ActivityLogEntry = 'ent',
  LinkedAccount = 'link',
  LinkToken = 'tok',
  Webhook = 'web',
}

export function generateId(prefix: Resource, byteLength = 8): string {
  return `${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function now() {
  return Math.floor(Date.now() / 1000);
}
