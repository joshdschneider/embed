import { HttpMethod, ProxyOptions } from '@embed/node';
import { DEFAULT_ERROR_MESSAGE, ErrorCode, errorService, proxyService } from '@embed/shared';
import { AxiosError } from 'axios';
import type { Request, Response } from 'express';
import type { OutgoingHttpHeaders } from 'http';
import querystring from 'querystring';
import { PassThrough, Readable, Transform } from 'stream';
import url from 'url';

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
      const headers = this.parseHeaders(req);
      const endpoint = this.buildEndpoint(req);
      const data = req.body;

      const options: ProxyOptions = {
        linkedAccountId,
        endpoint,
        method,
        headers,
        data,
        retries,
      };

      try {
        const axiosResponse = await proxyService.proxy(options);
        const passThroughStream = new PassThrough();
        axiosResponse.data.pipe(passThroughStream);
        passThroughStream.pipe(res);
        res.writeHead(axiosResponse.status, axiosResponse.headers as OutgoingHttpHeaders);
      } catch (err) {
        if (err instanceof AxiosError) {
          const error = err;
          if (!error.response?.data) {
            const { message, stack, config, code, status } = error;
            const errorObject = { message, stack, code, status, url, method: config?.method };
            const responseStatus = error.response?.status || 500;
            const responseHeaders = error.response?.headers || {};

            res.writeHead(responseStatus, responseHeaders as OutgoingHttpHeaders);
            const stream = new Readable();
            stream.push(JSON.stringify(errorObject));
            stream.push(null);
            stream.pipe(res);
          } else {
            const errorData = error.response.data as Readable;
            const stringify = new Transform({
              transform(chunk: Buffer, _encoding, callback) {
                callback(null, chunk);
              },
            });
            if (error.response.status) {
              res.writeHead(error.response.status, error.response.headers as OutgoingHttpHeaders);
            }
            if (errorData) {
              errorData.pipe(stringify).pipe(res);
            }
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

  private buildEndpoint(req: Request): string {
    const path = req.params[0] || '';
    const { query } = url.parse(req.url, true);
    const queryString = querystring.stringify(query);
    return `${path}${queryString ? `?${queryString}` : ''}`;
  }
}

export default new ProxyController();
