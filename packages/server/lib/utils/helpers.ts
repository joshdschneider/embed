import { AuthScheme, ProviderSpecification } from '@kit/providers';
import { Integration, getLocalhostUrl, getServerUrl } from '@kit/shared';
import crypto from 'crypto';
import { ZodError } from 'zod';
import { EnvironmentType } from './types';

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

export function missesInterpolationParam(str: string, replacers: Record<string, any>) {
  const strWithoutConfig = str.replace(/configuration\./g, '');
  const interpolatedStr = interpolateString(strWithoutConfig, replacers);
  return /\${([^{}]*)}/g.test(interpolatedStr);
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

export function generateWebhookSigningSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getWebhookSignatureHeader(
  payload: string,
  secret: string
): { 'X-Kit-Signature': string } {
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return { 'X-Kit-Signature': `sha256=${hash}` };
}

export function zodError(err: ZodError) {
  return err.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ');
}

export function getScopes(integration: Integration, providerSpec: ProviderSpecification): string[] {
  const scopes = new Set<string>();
  if (integration.proxy_scopes) {
    integration.proxy_scopes.split(',').forEach((scope) => scopes.add(scope));
  }

  if (providerSpec.collections) {
    providerSpec.collections.forEach((collection) => {
      collection.required_scopes?.forEach((scope) => scopes.add(scope));
    });
  }

  if (providerSpec.actions) {
    providerSpec.actions.forEach((action) => {
      action.required_scopes?.forEach((scope) => scopes.add(scope));
    });
  }

  if (
    providerSpec.auth.scheme === AuthScheme.OAuth2 ||
    providerSpec.auth.scheme === AuthScheme.OAuth1
  ) {
    providerSpec.auth.default_scopes?.forEach((scope) => scopes.add(scope));
  }

  return Array.from(scopes);
}
