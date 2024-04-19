import { HttpMethod, ProxyOptions, ResponseType } from '@embed/providers';
import { DEFAULT_ERROR_MESSAGE, ErrorCode, errorService, proxyService } from '@embed/shared';
import axios, { AxiosError } from 'axios';
import type { Request, Response } from 'express';
import type { OutgoingHttpHeaders } from 'http';
import { PassThrough } from 'stream';

class ProxyController {
  public async routeRequest(req: Request, res: Response): Promise<void> {
    try {
      const linkedAccountId = req.get('Embed-Linked-Account-Id');
      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID is missing',
        });
      }

      const method = req.method.toUpperCase() as HttpMethod;
      const retries = req.get('Retries') ? Number(req.get('Retries')) : 0;
      const baseUrlOverride = req.get('Base-Url-Override');
      const responseType = req.get('Response-Type');
      const headers = this.parseHeaders(req);
      const endpoint = this.parseEndpoint(req);
      const params = this.parseQueryParams(req);
      const data = req.body;

      const options: ProxyOptions = {
        linkedAccountId,
        endpoint,
        baseUrlOverride,
        method,
        responseType: responseType as ResponseType,
        headers,
        params,
        data,
        retries,
      };

      try {
        const axiosResponse = await proxyService.proxy(options);
        if (axiosResponse.data instanceof Buffer) {
          res.writeHead(axiosResponse.status, axiosResponse.headers as OutgoingHttpHeaders);
          res.end(axiosResponse.data);
        } else if (axiosResponse.data.pipe) {
          const passThroughStream = new PassThrough();
          axiosResponse.data.pipe(passThroughStream);
          passThroughStream.pipe(res);
          res.writeHead(axiosResponse.status, axiosResponse.headers as OutgoingHttpHeaders);
        } else {
          res.writeHead(axiosResponse.status, axiosResponse.headers as OutgoingHttpHeaders);
          res.end(JSON.stringify(axiosResponse.data));
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const axiosError = err as AxiosError;
          const statusCode = axiosError.response?.status || 500;
          const headers = axiosError.response?.headers || {};
          res.writeHead(statusCode, headers as OutgoingHttpHeaders);
          if (axiosError.response && axiosError.response.data) {
            if (
              typeof axiosError.response.data === 'object' &&
              !(axiosError.response.data instanceof Buffer)
            ) {
              res.end(JSON.stringify(axiosError.response.data));
            } else {
              res.end(axiosError.response.data);
            }
          } else {
            res.end('An error occurred');
          }
        } else {
          throw err;
        }
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private parseHeaders(req: Request): Record<string, string> {
    if (!req.rawHeaders) {
      return {};
    }

    const prefix = 'Embed-Proxy-';
    const headers = req.rawHeaders;

    return headers.reduce((acc: Record<string, string>, currentValue, currentIndex, array) => {
      if (currentIndex % 2 === 0) {
        const headerKey = currentValue.toLowerCase();
        if (headerKey.startsWith(prefix)) {
          const originalHeaderKey = currentValue.slice(prefix.length);
          acc[originalHeaderKey] = array[currentIndex + 1] || '';
        }
      }
      return acc;
    }, {});
  }

  private parseEndpoint(req: Request): string {
    const path = req.params[0] || '';
    return path;
  }

  private parseQueryParams(req: Request): Record<string, string | number> {
    const url = new URL(req.url);
    const params: Record<string, string | number> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  }
}

export default new ProxyController();
