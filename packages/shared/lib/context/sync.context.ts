import { ProxyOptions } from '@kit/node';
import { CursorPagination, LinkPagination, OffsetPagination, Pagination } from '@kit/providers';
import paginateService from '../services/paginate.service';
import providerService from '../services/provider.service';
import { BaseContext, BaseContextOptions } from './base.context';

export type PaginateOptions = Omit<ProxyOptions, 'integration' | 'linkedAccountId'> & {
  pagination?: Partial<CursorPagination> | Partial<LinkPagination> | Partial<OffsetPagination>;
};

export type SyncContextOptions = BaseContextOptions & {
  lastSyncDate: Date | null;
};

export class SyncContext extends BaseContext {
  public lastSyncDate: Date | null;

  constructor(options: SyncContextOptions) {
    super(options);
    this.lastSyncDate = options.lastSyncDate;
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
}
