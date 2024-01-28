import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import linkTokenService from '../services/linkToken.service';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  SUPPORTED_LANGUAGES,
  getServerUrl,
} from '../utils/constants';
import { Resource, generateId, now } from '../utils/helpers';

class LinkTokenController {
  public async createLinkToken(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const { integration, expires_in_mins, language, redirect_url, metadata } = req.body;

      if (integration && typeof integration !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid integration',
        });
      }

      const minMinutes = 30;
      const maxMinutes = 10080;

      if (
        expires_in_mins &&
        (typeof expires_in_mins !== 'number' ||
          expires_in_mins < minMinutes ||
          expires_in_mins > maxMinutes)
      ) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid expires_in_mins',
        });
      }

      const expiresAt = expires_in_mins ? now() + expires_in_mins * 60 : now() + minMinutes * 60;

      if (language && SUPPORTED_LANGUAGES.indexOf(language) === -1) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid language',
        });
      }

      if (redirect_url) {
        try {
          new URL(redirect_url);
        } catch {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid redirect_url',
          });
        }
      }

      if (metadata && typeof metadata !== 'object') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid metadata',
        });
      }

      const linkToken = await linkTokenService.createLinkToken({
        id: generateId(Resource.LinkToken),
        environment_id: environmentId,
        integration_provider: integration || null,
        expires_at: expiresAt,
        language: language || null,
        redirect_url: redirect_url || null,
        metadata: metadata || null,
        consent_given: false,
        consent_ip: null,
        consent_date: null,
        configuration: null,
        code_verifier: null,
        request_token_secret: null,
        websocket_client_id: null,
        created_at: now(),
        updated_at: now(),
      });

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(201).send({
        object: 'link_token',
        token: linkToken.id,
        url: this.buildLinkTokenUrl(linkToken.id, linkToken.integration_provider),
        expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
        integration: linkToken.integration_provider,
        redirect_url: linkToken.redirect_url,
        language: linkToken.language,
        metadata: linkToken.metadata,
        created_at: linkToken.created_at,
        updated_at: linkToken.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listLinkTokens(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const linkTokens = await linkTokenService.listLinkTokens(environmentId);

      if (!linkTokens) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const linkTokensList = linkTokens.map((linkToken) => {
        return {
          token: linkToken.id,
          url: this.buildLinkTokenUrl(linkToken.id, linkToken.integration_provider),
          expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
          integration: linkToken.integration_provider,
          redirect_url: linkToken.redirect_url,
          language: linkToken.language,
          metadata: linkToken.metadata,
          created_at: linkToken.created_at,
          updated_at: linkToken.updated_at,
        };
      });

      res.status(200).json({
        object: 'list',
        data: linkTokensList,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveLinkToken(req: Request, res: Response) {
    try {
      const token = req.params['token'];
      if (!token) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Token missing',
        });
      }

      const linkToken = await linkTokenService.getLinkTokenById(token);
      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Link token not found',
        });
      }

      res.status(201).send({
        object: 'link_token',
        token: linkToken.id,
        url: this.buildLinkTokenUrl(linkToken.id, linkToken.integration_provider),
        expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
        integration: linkToken.integration_provider,
        redirect_url: linkToken.redirect_url,
        language: linkToken.language,
        metadata: linkToken.metadata,
        created_at: linkToken.created_at,
        updated_at: linkToken.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async modifyLinkToken(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const linkTokenId = req.params['link_token_id'];
      const { integration, expires_in_mins, language, redirect_url, metadata } = req.body;

      if (!linkTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token ID missing',
        });
      }

      if (integration && typeof integration !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid integration',
        });
      }

      const minMinutes = 30;
      const maxMinutes = 10080;

      if (
        expires_in_mins &&
        (typeof expires_in_mins !== 'number' ||
          expires_in_mins < minMinutes ||
          expires_in_mins > maxMinutes)
      ) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid expires_in_mins',
        });
      }

      const expiresAt = expires_in_mins ? now() + expires_in_mins * 60 : minMinutes;

      if (language && SUPPORTED_LANGUAGES.indexOf(language) === -1) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid language',
        });
      }

      if (redirect_url) {
        try {
          new URL(redirect_url);
        } catch {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid redirect_url',
          });
        }
      }

      if (metadata && typeof metadata !== 'object') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid metadata',
        });
      }

      const linkToken = await linkTokenService.updateLinkToken(linkTokenId, environmentId, {
        integration_provider: integration || null,
        expires_at: expiresAt,
        language: language || null,
        redirect_url: redirect_url || null,
        metadata: metadata || null,
        updated_at: now(),
      });

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(201).send({
        object: 'link_token',
        token: linkToken.id,
        url: this.buildLinkTokenUrl(linkToken.id, linkToken.integration_provider),
        expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
        integration: linkToken.integration_provider,
        redirect_url: linkToken.redirect_url,
        language: linkToken.language,
        metadata: linkToken.metadata,
        created_at: linkToken.created_at,
        updated_at: linkToken.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private buildLinkTokenUrl(token: string, integration: string | null) {
    return `${getServerUrl()}/link/${token}${integration ? `/i/${integration}` : ''}`;
  }

  private expiresInMinutes(expiresAt: number) {
    return Math.floor((expiresAt - now()) / 60);
  }
}

export default new LinkTokenController();
