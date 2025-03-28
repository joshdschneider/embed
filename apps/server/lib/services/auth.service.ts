import {
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_LOCKED_REASON,
  EMBED_AUTH_TOKEN_KEY,
  EMBED_ENVIRONMENT_KEY,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  ORGANIZATION_ID_LOCALS_KEY,
  environmentService,
  errorService,
  getAuthTokenSecret,
} from '@embed/shared';
import Cookies from 'cookies';
import { NextFunction, Request, Response } from 'express';
import { errors, jwtVerify } from 'jose';

class AuthService {
  public async verifyApiKey(apiKey: string, req: Request, res: Response, next: NextFunction) {
    try {
      const environment = await environmentService.getEnvironmentByApiKey(apiKey);
      if (!environment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Invalid secret key',
        });
      }

      if (environment.locked) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: environment.locked_reason || DEFAULT_LOCKED_REASON,
        });
      }

      const { organization_id: organizationId, id: environmentId } = environment;
      res.locals[ORGANIZATION_ID_LOCALS_KEY] = organizationId;
      res.locals[ENVIRONMENT_ID_LOCALS_KEY] = environmentId;

      next();
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async verifyToken(
    req: Request,
    res: Response,
    next: NextFunction,
    options?: { verifyEnvironment?: boolean }
  ) {
    try {
      const authTokenSecret = getAuthTokenSecret();
      if (!authTokenSecret) {
        throw new Error('Auth token secret not set');
      }

      const cookies = Cookies(req, res);
      const token = cookies.get(EMBED_AUTH_TOKEN_KEY);
      if (!token) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Auth token missing',
        });
      }

      const secret = new Uint8Array(Buffer.from(authTokenSecret, 'base64'));
      const tokenResult = await jwtVerify<{ id: string }>(token, secret);
      const userId = tokenResult.payload['id'];
      if (!userId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Invalid token payload',
        });
      }

      if (options && options.verifyEnvironment === true) {
        const environmentId = cookies.get(EMBED_ENVIRONMENT_KEY);
        if (!environmentId) {
          return errorService.errorResponse(res, {
            code: ErrorCode.Forbidden,
            message: 'Environment ID missing',
          });
        }

        const environment = await environmentService.getEnvironmentById(environmentId);
        if (!environment) {
          return errorService.errorResponse(res, {
            code: ErrorCode.Forbidden,
            message: 'Environment does not exist',
          });
        }

        if (environment.locked) {
          return errorService.errorResponse(res, {
            code: ErrorCode.Forbidden,
            message: environment.locked_reason || DEFAULT_LOCKED_REASON,
          });
        }

        res.locals[ORGANIZATION_ID_LOCALS_KEY] = environment.organization_id;
        res.locals[ENVIRONMENT_ID_LOCALS_KEY] = environment.id;

        next();
      } else {
        next();
      }
    } catch (err) {
      if (err instanceof errors.JOSEError && err.code === 'ERR_JWT_EXPIRED') {
        return errorService.errorResponse(res, {
          code: ErrorCode.Unauthorized,
          message: 'Please sign in to continue',
        });
      } else {
        await errorService.reportError(err);
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }
    }
  }
}

export default new AuthService();
