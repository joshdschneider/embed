import { ProxyOptions } from '@kit/node';
import { CursorPagination, LinkPagination, OffsetPagination, Pagination } from '@kit/providers';
import { AxiosResponse } from 'axios';
import get from 'lodash-es/get.js';
import parseLinkHeader from 'parse-link-header';
import { PaginationType } from '../utils/enums';

export type PaginatePayload = {
  pagination: Pagination;
  paramsOrBody: Record<string, any>;
  useBody: boolean;
  proxyOptions: ProxyOptions;
  proxy: (options: ProxyOptions) => Promise<AxiosResponse>;
};

class PaginateService {
  public validate(pagination: Pagination): void {
    if (!pagination.type) {
      throw new Error('Pagination type is missing');
    }

    if (pagination.type.toLowerCase() === PaginationType.Cursor) {
      if (!(pagination as CursorPagination).cursor_name_in_request) {
        throw new Error('cursor_name_in_request parameter missing in cursor pagination');
      } else if (!(pagination as CursorPagination).cursor_path_in_response) {
        throw new Error('cursor_path_in_response parameter missing in cursor pagination');
      }

      if (pagination.limit && !pagination.limit_name_in_request) {
        throw new Error(
          'limit_name_in_request parameter is required when limit is present in cursor pagination'
        );
      }
    } else if (pagination.type.toLowerCase() === PaginationType.Link) {
      if (
        !(pagination as LinkPagination).link_rel_in_response_header &&
        !(pagination as LinkPagination).link_path_in_response_body
      ) {
        throw new Error(
          'One of link_rel_in_response_header or link_path_in_response_body are required for link pagination'
        );
      }
    } else if (pagination.type.toLowerCase() === PaginationType.Offset) {
      if (!(pagination as OffsetPagination).offset_name_in_request) {
        throw new Error('offset_name_in_request parameter is required for offset pagination');
      }
    } else {
      throw new Error(`Pagination type ${pagination.type} is not supported`);
    }
  }

  public async *cursor<T>(payload: PaginatePayload): AsyncGenerator<T[], undefined, void> {
    const cursorPagination = payload.pagination as CursorPagination;
    const cursorNameInRequest = cursorPagination.cursor_name_in_request;
    let nextCursor: string | undefined;

    while (true) {
      if (nextCursor) {
        payload.paramsOrBody[cursorNameInRequest] = nextCursor;
      }

      this.updateParamsOrBody(payload.proxyOptions, payload.paramsOrBody, payload.useBody);
      const response: AxiosResponse = await payload.proxy(payload.proxyOptions);
      const data: T[] = cursorPagination.response_path
        ? get(response.data, cursorPagination.response_path)
        : response.data;

      if (!data || !data.length) {
        return;
      }

      yield data;

      nextCursor = get(response.data, cursorPagination.cursor_path_in_response);
      if (!nextCursor || nextCursor.trim().length === 0) {
        return;
      }
    }
  }

  public async *link<T>(payload: PaginatePayload): AsyncGenerator<T[], undefined, void> {
    const linkPagination = payload.pagination as LinkPagination;
    this.updateParamsOrBody(payload.proxyOptions, payload.paramsOrBody, payload.useBody);

    while (true) {
      const response: AxiosResponse = await payload.proxy(payload.proxyOptions);
      const data: T[] = linkPagination.response_path
        ? get(response.data, linkPagination.response_path)
        : response.data;
      if (!data.length) {
        return;
      }

      yield data;

      const nextPageLink: string | undefined = this.getNextPageLink(linkPagination, response);
      if (!nextPageLink) {
        return;
      }

      if (!this.isValidUrl(nextPageLink)) {
        payload.proxyOptions.endpoint = nextPageLink;
      } else {
        const url: URL = new URL(nextPageLink);
        payload.proxyOptions.endpoint = url.pathname + url.search;
      }

      delete payload.proxyOptions.params;
    }
  }

  public async *offset<T>(payload: PaginatePayload): AsyncGenerator<T[], undefined, void> {
    const offsetPagination = payload.pagination as OffsetPagination;
    const offsetNameInRequest = offsetPagination.offset_name_in_request;
    let offset = 0;

    while (true) {
      payload.paramsOrBody[offsetNameInRequest] = `${offset}`;
      this.updateParamsOrBody(payload.proxyOptions, payload.paramsOrBody, payload.useBody);

      const response: AxiosResponse = await payload.proxy(payload.proxyOptions);
      const data: T[] = offsetPagination.response_path
        ? get(response.data, offsetPagination.response_path)
        : response.data;

      if (!data || !data.length) {
        return;
      }

      yield data;

      if (offsetPagination['limit'] && data.length < offsetPagination['limit']) {
        return;
      }

      if (data.length < 1) {
        return;
      }

      offset += data.length;
    }
  }

  private updateParamsOrBody(
    proxyOptions: ProxyOptions,
    paramsOrBody: Record<string, string>,
    useBody: boolean
  ) {
    if (useBody) {
      proxyOptions.data = paramsOrBody;
    } else {
      proxyOptions.params = paramsOrBody;
    }
  }

  private getNextPageLink(
    linkPagination: LinkPagination,
    response: AxiosResponse
  ): string | undefined {
    if (linkPagination.link_rel_in_response_header) {
      const header = parseLinkHeader(response.headers['link']);
      return header?.[linkPagination.link_rel_in_response_header]?.url;
    } else if (linkPagination.link_path_in_response_body) {
      return get(response.data, linkPagination.link_path_in_response_body);
    }

    throw Error(
      `One of link_rel_in_response_header or link_path_in_response_body are required for link pagination`
    );
  }

  private isValidUrl(str: string) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}

export default new PaginateService();
