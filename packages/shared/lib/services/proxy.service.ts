import { AuthScheme, ProviderSpecification, ProxyOptions } from '@embed/providers';
import { LinkedAccount } from '@prisma/client';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { backOff } from 'exponential-backoff';
import { DEFAULT_PROXY_ATTEMPTS, DEFAULT_PROXY_RESPONSE_TYPE } from '../utils/constants';
import { interpolateIfNeeded } from '../utils/helpers';
import linkedAccountService from './linkedAccount.service';
import providerService from './provider.service';

class ProxyService {
  public async proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>> {
    const linkedAccount = await linkedAccountService.getLinkedAccountById(options.linkedAccountId);
    if (!linkedAccount) {
      throw new AxiosError(`Linked account not found with ID ${options.linkedAccountId}`, '400');
    }

    const providerSpec = await providerService.getProviderSpec(linkedAccount.integration_key);
    if (!providerSpec) {
      throw new Error('Provider specification not found');
    }

    const url = this.buildUrl(linkedAccount, providerSpec, options);
    const headers = this.buildHeaders(linkedAccount, providerSpec, options);
    const data = this.formatData(options);

    const config: AxiosRequestConfig = {
      url,
      method: options.method,
      responseType: options.responseType || DEFAULT_PROXY_RESPONSE_TYPE,
      headers,
    };

    if (config.method && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      config.data = data || {};
    }

    let tokenRefreshAttempted = false;

    const responseStream: AxiosResponse = await backOff(
      async () => {
        try {
          return await axios(config);
        } catch (err) {
          if (err instanceof AxiosError && this.isTokenError(err) && !tokenRefreshAttempted) {
            const newToken = await linkedAccountService.attemptTokenRefresh(
              linkedAccount,
              providerSpec
            );

            tokenRefreshAttempted = true;

            if (newToken) {
              config.headers = { ...config.headers, Authorization: `Bearer ${newToken}` };
              return await axios(config);
            }
          }

          throw err;
        }
      },
      {
        numOfAttempts: Number(options.retries) || DEFAULT_PROXY_ATTEMPTS,
        retry: (error, attempt) => this.retryRequest(error, providerSpec.retry),
      }
    );

    return responseStream;
  }

  private async retryRequest(
    error: AxiosError,
    retry?: { at?: string; after?: string }
  ): Promise<boolean> {
    if (this.isRateLimitError(error)) {
      if (retry && (retry.at || retry.after)) {
        const type = retry.at ? 'at' : 'after';
        const retryHeader = retry.at ? retry.at : retry.after;
        return await this.retryHandler(error, type, retryHeader as string);
      }

      return true;
    }

    return false;
  }

  public async retryHandler(
    error: AxiosError,
    type: 'at' | 'after',
    retryHeader: string
  ): Promise<boolean> {
    if (type === 'at') {
      const resetTimeEpoch =
        error.response?.headers[retryHeader] || error.response?.headers[retryHeader.toLowerCase()];

      if (resetTimeEpoch) {
        const currentEpochTime = Math.floor(Date.now() / 1000);
        const retryAtEpoch = Number(resetTimeEpoch);
        if (retryAtEpoch > currentEpochTime) {
          const waitDuration = retryAtEpoch - currentEpochTime;
          await new Promise((resolve) => setTimeout(resolve, waitDuration * 1000));
          return true;
        }
      }
    }

    if (type === 'after') {
      const retryHeaderVal =
        error.response?.headers[retryHeader] || error.response?.headers[retryHeader.toLowerCase()];

      if (retryHeaderVal) {
        const retryAfter = Number(retryHeaderVal);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return true;
      }
    }

    return true;
  }

  private buildUrl(
    linkedAccount: LinkedAccount,
    providerSpec: ProviderSpecification,
    options: ProxyOptions
  ): string {
    const { configuration } = linkedAccount;

    const baseUrl = options.baseUrlOverride
      ? options.baseUrlOverride.endsWith('/')
        ? options.baseUrlOverride.slice(0, -1)
        : options.baseUrlOverride
      : providerSpec.base_url.endsWith('/')
        ? providerSpec.base_url.slice(0, -1)
        : providerSpec.base_url;

    let endpoint =
      options.endpoint.charAt(0) === '/' ? options.endpoint.slice(1) : options.endpoint;

    if (endpoint.includes(baseUrl)) {
      endpoint = endpoint.replace(baseUrl, '');
    }

    const interpolatedEndpoint = interpolateIfNeeded(
      `${baseUrl}${endpoint ? '/' : ''}${endpoint}`,
      { configuration }
    );

    const params = new URLSearchParams();
    Object.entries(options.params || {}).forEach(([key, value]) => {
      params.append(key, value.toString());
    });

    return interpolatedEndpoint + '?' + params.toString();
  }

  private buildHeaders(
    linkedAccount: LinkedAccount,
    providerSpec: ProviderSpecification,
    options: ProxyOptions
  ): Record<string, string> {
    let headers: Record<string, string> = {};
    const credentials = JSON.parse(linkedAccount.credentials);

    if (
      providerSpec.auth.scheme === AuthScheme.OAuth1 ||
      providerSpec.auth.scheme === AuthScheme.OAuth2
    ) {
      const { access_token } = credentials;
      headers['Authorization'] = `Bearer ${access_token}`;
    } else if (providerSpec.auth.scheme === AuthScheme.Basic) {
      const { username, password } = credentials;
      headers['Authorization'] =
        `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`;
    }

    if (providerSpec.headers) {
      const interpolatedEntries = Object.entries(providerSpec.headers).map(([k, v]) => {
        const val = interpolateIfNeeded(v, credentials);
        return [k, val];
      });

      headers = {
        ...headers,
        ...Object.fromEntries(interpolatedEntries),
      };
    }

    if (options.headers) {
      headers = { ...headers, ...options.headers };
    }

    return headers;
  }

  private formatData(options: ProxyOptions) {
    if (options.headers && options.headers['Content-Type'] === 'multipart/form-data') {
      const formData = new FormData();
      const data = (options.data as Record<string, any>) || {};

      Object.keys(data).forEach((key) => {
        formData.append(key, data[key]);
      });

      return formData;
    } else {
      return options.data;
    }
  }

  private isTokenError(error: AxiosError): boolean {
    return error.response?.status === 401 || error.response?.status === 403;
  }

  private isRateLimitError(error: AxiosError): boolean {
    return (
      error.response?.status.toString().startsWith('5') ||
      (error.response?.status === 403 &&
        error.response?.headers['x-ratelimit-remaining'] &&
        error.response?.headers['x-ratelimit-remaining'] === '0') ||
      error.response?.status === 429 ||
      (error.code && ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(error.code))
    );
  }
}

export default new ProxyService();
