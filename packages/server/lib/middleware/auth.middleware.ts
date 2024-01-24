import Cookies from 'cookies';
import type { NextFunction, Request, Response } from 'express';
import authService from '../services/auth.service';
import errorService, { ErrorCode } from '../services/error.service';
import { BETA_CLOUD_AUTH_TOKEN_KEY, isCloud } from '../utils/constants';

class AuthMiddleware {
  public async apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.get('authorization');
    if (authHeader) {
      const secretKey = authHeader.split('Bearer ').pop();
      if (secretKey) {
        return authService.verifyApiKey(secretKey, req, res, next);
      }
    }

    if (isCloud()) {
      const cookies = Cookies(req, res);
      const token = cookies.get(BETA_CLOUD_AUTH_TOKEN_KEY);
      if (token) {
        return authService.verifyTokenEnvironment(token, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Secret key is required',
    });
  }

  public async cloudUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (isCloud()) {
      const cookies = Cookies(req, res);
      const token = cookies.get(BETA_CLOUD_AUTH_TOKEN_KEY);
      if (token) {
        return authService.verifyTokenUser(token, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Cloud credentials are required',
    });
  }

  public async cloudEnvironmentAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (isCloud()) {
      const cookies = Cookies(req, res);
      const token = cookies.get(BETA_CLOUD_AUTH_TOKEN_KEY);
      if (token) {
        return authService.verifyTokenEnvironment(token, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Cloud credentials are required',
    });
  }
}

export default new AuthMiddleware();
