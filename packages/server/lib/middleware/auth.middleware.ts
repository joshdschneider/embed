import { ErrorCode, errorService, isCloud, isEnterprise } from '@kit/shared';
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
      return authService.verifyToken(req, res, next, { verifyEnvironment: true });
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Missing authorization credentials',
    });
  }

  public async webUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (isCloud() || isEnterprise()) {
      return authService.verifyToken(req, res, next);
    } else {
      return errorService.errorResponse(res, { code: ErrorCode.Unauthorized });
    }
  }

  public async webEnvironmentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (isCloud() || isEnterprise()) {
      return authService.verifyToken(req, res, next, { verifyEnvironment: true });
    } else {
      return errorService.errorResponse(res, { code: ErrorCode.Unauthorized });
    }
  }

  public async internalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.get('authorization');
    if (authHeader) {
      const secretKey = authHeader.split('Bearer ').pop();
      if (secretKey) {
        return authService.verifyInternalApiKey(secretKey, req, res, next);
      }
    } else {
      return errorService.errorResponse(res, { code: ErrorCode.Unauthorized });
    }
  }
}

export default new AuthMiddleware();
