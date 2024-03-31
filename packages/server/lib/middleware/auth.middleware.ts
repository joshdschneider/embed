import { ErrorCode, errorService } from '@embed/shared';
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

    const clientHeader = req.get('client');
    if (clientHeader && clientHeader.toLowerCase() === 'embed-ui') {
      return authService.verifyToken(req, res, next, { verifyEnvironment: true });
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Missing authorization credentials',
    });
  }

  public async webUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    return authService.verifyToken(req, res, next);
  }

  public async webEnvironmentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    return authService.verifyToken(req, res, next, { verifyEnvironment: true });
  }

  public async internalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.get('authorization');
    if (authHeader) {
      const secretKey = authHeader.split('Bearer ').pop();
      if (secretKey) {
        return authService.verifyInternalApiKey(secretKey, req, res, next);
      }
    }

    return errorService.errorResponse(res, {
      code: ErrorCode.Unauthorized,
      message: 'Internal authorization required',
    });
  }
}

export default new AuthMiddleware();
