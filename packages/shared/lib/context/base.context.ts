import { ProxyOptions } from '@embed/node';
import { AxiosResponse } from 'axios';
import proxyService from '../services/proxy.service';

export interface BaseContextOptions {
  integrationKey: string;
  linkedAccountId: string;
}

export class BaseContext {
  protected integrationKey: string;
  protected linkedAccountId: string;

  constructor(options: BaseContextOptions) {
    this.integrationKey = options.integrationKey;
    this.linkedAccountId = options.linkedAccountId;
  }

  public async proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>> {
    return await proxyService.proxy<T>(options);
  }

  public async get<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'GET' });
  }

  public async post<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'POST' });
  }

  public async patch<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'PATCH' });
  }

  public async put<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'PUT' });
  }

  public async delete<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'DELETE' });
  }
}
