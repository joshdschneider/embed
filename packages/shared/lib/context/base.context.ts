import { InternalProxyOptions, MethodProxyOptions } from '@embed/providers';
import { ActivityLog } from '@prisma/client';
import { AxiosResponse } from 'axios';
import loggerClient from '../clients/logger.client';
import activityService from '../services/activity.service';
import errorService from '../services/error.service';
import proxyService from '../services/proxy.service';
import { LogLevel } from '../utils/enums';
import { now } from '../utils/helpers';

export interface BaseContextOptions {
  environmentId: string;
  integrationId: string;
  connectionId: string;
  activityId: string | null;
}

export class BaseContext {
  protected environmentId: string;
  protected integrationId: string;
  protected connectionId: string;
  public activityId: string | null;

  constructor(options: BaseContextOptions) {
    this.environmentId = options.environmentId;
    this.integrationId = options.integrationId;
    this.connectionId = options.connectionId;
    this.activityId = options.activityId;
  }

  public async proxy<T = any>(options: InternalProxyOptions): Promise<AxiosResponse<T>> {
    return await proxyService.proxy<T>({ ...options, connectionId: this.connectionId });
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

  public async reportError(err: unknown): Promise<void> {
    return await errorService.reportError(err);
  }

  public log(message: string): void {
    loggerClient.log(LogLevel.Info, message);
  }

  public async createActivityLog(activityLog: {
    level: LogLevel;
    message: string;
    payload?: object | undefined;
  }): Promise<ActivityLog | null> {
    return await activityService.createActivityLog(this.activityId, {
      ...activityLog,
      timestamp: now(),
    });
  }
}
