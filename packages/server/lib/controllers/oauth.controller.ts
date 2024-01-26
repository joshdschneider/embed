import { AuthScheme, OAuth1, OAuth2 } from '@beta/providers';
import { LinkToken } from '@prisma/client';
import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import linkTokenService from '../services/linkToken.service';
import providerService from '../services/provider.service';
import { DEFAULT_ERROR_MESSAGE } from '../utils/constants';
import { now } from '../utils/helpers';

class OAuthController {
  public async authorize(req: Request, res: Response) {
    const token = req.query['token'];

    if (!token || typeof token !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
        });
      }

      const provider = await providerService.getProviderSpec(linkToken.integration_provider);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid integration provider',
        });
      }

      if (provider.auth.scheme === AuthScheme.OAUTH2) {
        return this.oauth2Request(res, {
          authSpec: provider.auth as OAuth2,
          linkToken,
        });
      } else if (provider.auth.scheme === AuthScheme.OAUTH1) {
        return this.oauth1Request(res, {
          authSpec: provider.auth as OAuth1,
          linkToken,
        });
      } else {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid auth scheme',
        });
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private async oauth2Request(
    res: Response,
    {
      authSpec,
      linkToken,
    }: {
      authSpec: OAuth2;
      linkToken: LinkToken;
    }
  ) {
    //..
  }

  private async oauth1Request(
    res: Response,
    {
      authSpec,
      linkToken,
    }: {
      authSpec: OAuth1;
      linkToken: LinkToken;
    }
  ) {
    //..
  }

  public async callback(req: Request, res: Response) {
    //..
  }
}

export default new OAuthController();
