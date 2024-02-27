import {
  ACCOUNT_ID_LOCALS_KEY,
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  KIT_AUTH_TOKEN_KEY,
  KIT_ENVIRONMENT_KEY,
  environmentService,
  errorService,
  getAuthTokenSecret,
  getInternalApiKey,
} from '@kit/shared';
import Cookies from 'cookies';
import { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';

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

      const { account_id: accountId, id: environmentId } = environment;
      res.locals[ACCOUNT_ID_LOCALS_KEY] = accountId;
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
    options?: { verifyEnvironment: boolean }
  ) {
    try {
      const authTokenSecret = getAuthTokenSecret();
      if (!authTokenSecret) {
        throw new Error('Auth token secret not set');
      }

      const cookies = Cookies(req, res);
      const token = cookies.get(KIT_AUTH_TOKEN_KEY);
      if (!token) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Auth token missing',
        });
      }

      const secret = new Uint8Array(Buffer.from(authTokenSecret, 'base64'));
      const tokenResult = await jwtVerify<{ user: { id: string } }>(token, secret);
      const user = tokenResult.payload['user'];
      if (!user.id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Invalid token payload',
        });
      }

      if (options && options.verifyEnvironment === true) {
        const environmentId = cookies.get(KIT_ENVIRONMENT_KEY);
        if (!environmentId) {
          return errorService.errorResponse(res, {
            code: ErrorCode.Forbidden,
            message: 'Environment ID missing',
          });
        }

        const environment = await environmentService.findUserEnvironment(user.id, environmentId);
        if (!environment) {
          return errorService.errorResponse(res, {
            code: ErrorCode.Forbidden,
            message: 'Environment does not exist',
          });
        }

        res.locals[ACCOUNT_ID_LOCALS_KEY] = environment.account_id;
        res.locals[ENVIRONMENT_ID_LOCALS_KEY] = environment.id;

        next();
      } else {
        next();
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async verifyInternalApiKey(
    apiKey: string,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const internalApiKey = getInternalApiKey();

      if (!internalApiKey) {
        throw new Error('Internal API key not set');
      }

      if (internalApiKey !== apiKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Unauthorized,
          message: 'Invalid internal API key',
        });
      } else {
        next();
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new AuthService();
