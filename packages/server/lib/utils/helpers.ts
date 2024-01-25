import crypto from 'crypto';
import type { Response } from 'express';
import { EnvironmentType } from '../types';

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

export function generateSecreyKey(environment: EnvironmentType, byteLength = 16): string {
  const prefix = environment === EnvironmentType.Staging ? 'test' : 'prod';
  return `sk_${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export enum Resource {
  Account = 'acc',
  ApiKey = 'key',
  Environment = 'env',
  ActivityLog = 'log',
  ActivityLogEntry = 'ent',
  LinkedAccount = 'link',
  LinkToken = 'tok',
}

export function generateId(prefix: Resource, byteLength = 8): string {
  return `${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function now() {
  return Math.floor(Date.now() / 1000);
}
