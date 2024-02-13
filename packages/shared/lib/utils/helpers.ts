import crypto from 'crypto';
import { Resource } from './enums';

export function generateId(prefix: Resource, byteLength = 8): string {
  return `${prefix}_${crypto.randomBytes(byteLength).toString('hex')}`;
}

export function now() {
  return Math.floor(Date.now() / 1000);
}
