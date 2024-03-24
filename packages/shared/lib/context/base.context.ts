import { InternalProxyOptions, MethodProxyOptions } from '@embed/providers';
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

  public async proxy<T = any>(options: InternalProxyOptions): Promise<AxiosResponse<T>> {
    return await proxyService.proxy<T>({ ...options, linkedAccountId: this.linkedAccountId });
  }

  public async get<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'GET' });
  }

  public async post<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'POST' });
  }

  public async patch<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'PATCH' });
  }

  public async put<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'PUT' });
  }

  public async delete<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>> {
    return await this.proxy<T>({ ...options, method: 'DELETE' });
  }
}
