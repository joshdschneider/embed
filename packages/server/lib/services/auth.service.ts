import Cookies from 'cookies';
import { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import {
  ACCOUNT_ID_LOCALS_KEY,
  BETA_CLOUD_ENVIRONMENT_KEY,
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  getAuthTokenSecret,
} from '../utils/constants';
import environmentService from './environment.service';
import errorService, { ErrorCode } from './error.service';

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

  public async verifyTokenUser(token: string, req: Request, res: Response, next: NextFunction) {
    try {
      const authTokenSecret = getAuthTokenSecret();
      if (!authTokenSecret) {
        throw new Error('Auth token secret is not defined');
      }

      const secret = new Uint8Array(Buffer.from(authTokenSecret, 'base64'));
      const tokenResult = await jwtVerify<{
        user: { id: string };
      }>(token, secret);

      const user = tokenResult.payload['user'];
      if (!user.id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Invalid token payload',
        });
      }

      next();
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async verifyTokenEnvironment(
    token: string,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const authTokenSecret = getAuthTokenSecret();
      if (!authTokenSecret) {
        throw new Error('Auth token secret is not defined');
      }

      const secret = new Uint8Array(Buffer.from(authTokenSecret, 'base64'));
      const tokenResult = await jwtVerify<{
        user: { id: string };
      }>(token, secret);

      const user = tokenResult.payload['user'];
      if (!user.id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Invalid token payload',
        });
      }

      const cookies = Cookies(req, res);
      const environmentId = cookies.get(BETA_CLOUD_ENVIRONMENT_KEY);
      if (!environmentId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: 'Invalid environment ID',
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
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: 'Something went wrong',
      });
    }
  }
}

export default new AuthService();
