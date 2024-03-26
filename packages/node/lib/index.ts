import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const DEFAULT_HOST = 'https://api.useembed.com';

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PATCH'
  | 'PUT'
  | 'DELETE'
  | 'get'
  | 'post'
  | 'patch'
  | 'put'
  | 'delete';

export type EmbedOptions = {
  host?: string;
  apiKey: string;
};

export type ResponseType = 'arraybuffer' | 'json' | 'text' | 'stream';

export interface ProxyOptions {
  linkedAccountId: string;
  endpoint: string;
  baseUrlOverride?: string;
  method?: HttpMethod;
  responseType?: ResponseType;
  headers?: Record<string, string>;
  params?: string | Record<string, string | number>;
  data?: unknown;
  retries?: number;
}

export default class Embed {
  private hostBaseUrl: string;
  private apiKey: string;

  constructor(options: EmbedOptions) {
    if (!options.apiKey) {
      throw new Error('API Key is required');
    }

    this.apiKey = options.apiKey;
    const host = options.host || DEFAULT_HOST;
    this.hostBaseUrl = host.endsWith('/') ? host.slice(0, -1) : host;

    try {
      new URL(this.hostBaseUrl);
    } catch (err) {
      throw new Error('Invalid host URL');
    }
  }

  public async proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>> {
    const requiredParams: Array<keyof ProxyOptions> = ['endpoint', 'linkedAccountId'];

    requiredParams.forEach((param) => {
      if (typeof options[param] === 'undefined') {
        throw new Error(`${param} required to make proxy request`);
      }
    });

    const url = `${this.hostBaseUrl}/v1/proxy${options.endpoint[0] === '/' ? '' : '/'}${options.endpoint}`;
    const headerOptions = options.headers;

    const customHeaders =
      headerOptions && Object.keys(headerOptions).length > 0
        ? Object.keys(headerOptions).reduce((acc: Record<string, string>, key: string) => {
            acc[`Embed-Proxy-${key}`] = headerOptions[key] as string;
            return acc;
          }, {})
        : {};

    const headers: Record<string, string | number | boolean> = {
      'Embed-Linked-Account-Id': options.linkedAccountId,
      'Base-Url-Override': options.baseUrlOverride || '',
      'Response-Type': options.responseType || '',
      ...customHeaders,
    };

    if (options.retries) {
      headers['Retries'] = options.retries;
    }

    const config: AxiosRequestConfig = {
      headers: this.attachAuthorization(headers),
      responseType: options.responseType,
    };

    if (options.params) {
      config.params = options.params;
    }

    if (!options.method || options.method.toUpperCase() === 'GET') {
      return axios.get(url, config);
    } else if (options.method.toUpperCase() === 'POST') {
      return axios.post(url, options.data, config);
    } else if (options.method.toUpperCase() === 'PATCH') {
      return axios.patch(url, options.data, config);
    } else if (options.method.toUpperCase() === 'PUT') {
      return axios.put(url, options.data, config);
    } else if (options.method.toUpperCase() === 'DELETE') {
      return axios.delete(url, config);
    } else {
      throw new Error('Invalid HTTP method for proxy request');
    }
  }

  public async get<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.proxy({ ...options, method: 'GET' });
  }

  public async post<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.proxy({ ...options, method: 'POST' });
  }

  public async patch<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.proxy({ ...options, method: 'PATCH' });
  }

  public async put<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.proxy({ ...options, method: 'PUT' });
  }

  public async delete<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.proxy({ ...options, method: 'DELETE' });
  }

  private attachAuthorization(
    headers: Record<string, string | number | boolean> = {}
  ): Record<string, string | number | boolean> {
    headers['Authorization'] = 'Bearer ' + this.apiKey;
    return headers;
  }
}
