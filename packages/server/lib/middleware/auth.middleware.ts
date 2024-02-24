import {
  ErrorCode,
  KIT_AUTH_TOKEN_KEY,
  errorService,
  getInternalApiKey,
  isCloud,
  isEnterprise,
} from '@kit/shared';
import Cookies from 'cookies';
import type { NextFunction, Request, Response } from 'express';
import authService from '../services/auth.service';

class AuthMiddleware {
  public async apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.get('authorization');
    if (authHeader) {
      const secretKey = authHeader.split('Bearer ').pop();
      if (secretKey) {
        return authService.verifyApiKey(secretKey, req, res, next);
      }
    }

    if (isCloud() || isEnterprise()) {
      const cookies = Cookies(req, res);
      const token = cookies.get(KIT_AUTH_TOKEN_KEY);
      if (token) {
        return authService.verifyTokenEnvironment(token, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Missing authorization credentials',
    });
  }

  public async webUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (isCloud() || isEnterprise()) {
      const cookies = Cookies(req, res);
      const token = cookies.get(KIT_AUTH_TOKEN_KEY);
      if (token) {
        return authService.verifyTokenUser(token, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Missing authorization credentials',
    });
  }

  public async webEnvironmentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (isCloud() || isEnterprise()) {
      const cookies = Cookies(req, res);
      const token = cookies.get(KIT_AUTH_TOKEN_KEY);
      if (token) {
        return authService.verifyTokenEnvironment(token, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Missing authorization credentials',
    });
  }

  public async internalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.get('authorization');
    if (authHeader) {
      const apiKey = authHeader.split('Bearer ').pop();
      const internalApiKey = getInternalApiKey();

      if (!internalApiKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: 'Internal API key not set',
        });
      }

      if (apiKey) {
        if (internalApiKey === apiKey) {
          return next();
        } else {
          return errorService.errorResponse(res, {
            code: ErrorCode.Unauthorized,
            message: 'Invalid internal API key',
          });
        }
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Forbidden,
      message: 'Internal use only',
    });
  }
}

export default new AuthMiddleware();
