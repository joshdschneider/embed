import Kit, { ProxyOptions } from '@kit/node';
import { AxiosResponse } from 'axios';
import paginateService from '../services/paginate.service';
import providerService from '../services/provider.service';
import proxyService from '../services/proxy.service';

type KitSyncOptions = {
  integration: string;
  linkedAccountId: string;
  apiKey?: string;
};

export type PaginateOptions = Omit<ProxyOptions, 'integration' | 'linkedAccountId'>;

/**
 * An instance of this class will be injected
 * into provider registry's sync method so that
 * when you implement a provider integration,
 * you can use these methods to paginate and
 * make authenticated requests to the provider's API
 */

export class KitSync {
  private integration: string;
  private linkedAccountId: string;
  private kit?: Kit;

  constructor(options: KitSyncOptions) {
    this.integration = options.integration;
    this.linkedAccountId = options.linkedAccountId;

    if (options.apiKey) {
      this.kit = new Kit({ apiKey: options.apiKey });
    }
  }

  public async proxy<T = any>(config: ProxyOptions): Promise<AxiosResponse<T>> {
    if (this.kit) {
      return this.kit.proxy(config);
    } else {
      // Go straight to proxy service ??
      // only if previously authenticated !!
      return await proxyService.route(config);
    }
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

    paginateService.validate(provider.pagination);

    const method = paginateOptions.method?.toUpperCase() || 'GET';
    const useBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const { data, params } = paginateOptions;
    const paramsOrBody: Record<string, any> = (useBody ? data : params) ?? {};
    const limitNameInRequest = provider.pagination.limit_name_in_request;

    if (provider.pagination['limit']) {
      paramsOrBody[limitNameInRequest] = provider.pagination['limit'];
    }

    const proxyOptions: ProxyOptions = {
      ...paginateOptions,
      integration: this.integration,
      linkedAccountId: this.linkedAccountId,
    };

    const paginatePayload = {
      pagination: provider.pagination,
      paramsOrBody,
      useBody,
      proxyOptions,
      proxy: this.proxy.bind(this),
    };

    switch (provider.pagination.type) {
      case 'cursor':
        return yield* paginateService.cursor<T>(paginatePayload);
      case 'link':
        return yield* paginateService.link<T>(paginatePayload);
      case 'offset':
        return yield* paginateService.offset<T>(paginatePayload);
      default:
        throw new Error(`Unsupported pagination type: ${provider.pagination.type}`);
    }
  }
}
