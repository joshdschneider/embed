import { AxiosRequestConfig, AxiosResponse } from 'axios';

type HttpMethod =
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

export interface ProxyOptions {
  integration: string;
  linkedAccountId: string;
  endpoint: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: string | Record<string, string | number>;
  data?: unknown;
  retries?: number;
}

class ProxyService {
  public async route(options: ProxyOptions): Promise<AxiosResponse> {
    const config: AxiosRequestConfig = { headers: options.headers };
    if (options.params) {
      config.params = options.params;
    }

    if (options.data) {
      config.data = options.data;
    }

    config.url = this.constructUrl(options);
    config.method = options.method;

    const headers = this.constructHeaders(options);
    config.headers = {
      ...config.headers,
      ...headers,
    };

    return this.request(config, options);
  }

  private async request(config: AxiosRequestConfig, options: ProxyOptions): Promise<AxiosResponse> {
    return {} as AxiosResponse;
  }

  private constructUrl(options: ProxyOptions) {
    return '';
  }

  private constructHeaders(options: ProxyOptions) {
    return {};
  }
}

export default new ProxyService();
