import Kit, { ProxyOptions } from '@kit/node';
import { AxiosResponse } from 'axios';

export interface BaseContextOptions {
  integration: string;
  linkedAccountId: string;
  apiKey: string;
  host?: string;
}

export class BaseContext {
  protected integration: string;
  protected linkedAccountId: string;
  protected kit: Kit;

  constructor(options: BaseContextOptions) {
    this.integration = options.integration;
    this.linkedAccountId = options.linkedAccountId;
    this.kit = new Kit({
      apiKey: options.apiKey,
      host: options.host,
    });
  }

  public async proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>> {
    return await this.kit.proxy(options);
  }

  public async get<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.kit.get(options);
  }

  public async post<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.kit.post(options);
  }

  public async patch<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.kit.patch(options);
  }

  public async put<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.kit.put(options);
  }

  public async delete<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return this.kit.delete(options);
  }
}
