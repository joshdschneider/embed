import { ProxyOptions } from '@kit/node';
import { PaginateOptions, Pagination } from '@kit/providers';
import { Context } from '@temporalio/activity';
import paginateService from '../services/paginate.service';
import providerService from '../services/provider.service';
import { BaseContext, BaseContextOptions } from './base.context';

export type SyncContextOptions = BaseContextOptions & {
  syncId: string;
  jobId: string;
  activityId: string | null;
  lastSyncDate: Date | null;
  context: Context;
};

export class SyncContext extends BaseContext {
  public syncId: string;
  public jobId: string;
  public activityId: string | null;
  public lastSyncDate: Date | null;

  private batchSize = 1000;
  private addedKeys: string[];
  private updatedKeys: string[];
  private deletedKeys: string[];
  private interval?: NodeJS.Timeout;

  constructor(options: SyncContextOptions) {
    super(options);
    this.syncId = options.syncId;
    this.jobId = options.jobId;
    this.activityId = options.activityId;
    this.lastSyncDate = options.lastSyncDate;
    this.addedKeys = [];
    this.updatedKeys = [];
    this.deletedKeys = [];

    const temporal = options.context;
    const heartbeat = 1000 * 60 * 5;
    this.interval = setInterval(() => {
      temporal.heartbeat();
    }, heartbeat);
  }

  public async *paginate<T = any>(
    paginateOptions: PaginateOptions
  ): AsyncGenerator<T[], undefined, void> {
    const provider = await providerService.getProviderSpec(this.integration);

    if (!provider) {
      throw new Error(`Provider not found for integration: ${this.integration}`);
    } else if (!provider.pagination) {
      throw new Error(`Pagination not configured in provider specification: ${this.integration}`);
    }

    const pagination: Pagination = {
      ...(provider.pagination || {}),
      ...(paginateOptions.pagination || {}),
    };

    paginateService.validate(pagination);

    const method = paginateOptions.method?.toUpperCase() || 'GET';
    const useBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const { data, params } = paginateOptions;
    const paramsOrBody: Record<string, any> = (useBody ? data : params) ?? {};
    const limitNameInRequest = pagination.limit_name_in_request;

    if (pagination['limit']) {
      paramsOrBody[limitNameInRequest] = pagination['limit'];
    }

    const proxyOptions: ProxyOptions = {
      ...paginateOptions,
      integration: this.integration,
      linkedAccountId: this.linkedAccountId,
    };

    const paginatePayload = {
      pagination,
      paramsOrBody,
      useBody,
      proxyOptions,
      proxy: this.proxy.bind(this),
    };

    switch (pagination.type) {
      case 'cursor':
        return yield* paginateService.cursor<T>(paginatePayload);
      case 'link':
        return yield* paginateService.link<T>(paginatePayload);
      case 'offset':
        return yield* paginateService.offset<T>(paginatePayload);
      default:
        throw new Error(`Unsupported pagination type: ${pagination.type}`);
    }
  }

  public async batchSave<T = any>(results: T[], model: string): Promise<boolean | null> {
    if (!results || results.length === 0) {
      return true;
    }

    // format data
    // save data
    // update keys

    return true;
  }

  public async finish() {
    clearInterval(this.interval);
    this.interval = undefined;
  }
}
