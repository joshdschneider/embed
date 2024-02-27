import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  LogAction,
  LogLevel,
  Resource,
  SUPPORTED_LANGUAGES,
  activityService,
  errorService,
  generateId,
  getServerUrl,
  linkedAccountService,
  now,
} from '@kit/shared';
import { Metadata } from '@temporalio/client';
import type { Request, Response } from 'express';
import linkTokenService from '../services/linkToken.service';
import { zodError } from '../utils/helpers';
import {
  CreateLinkTokenRequestSchema,
  LinkTokenDeletedObject,
  LinkTokenObject,
} from '../utils/types';

class LinkTokenController {
  public async createLinkToken(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const parsedBody = CreateLinkTokenRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const {
        integration,
        linked_account_id: linkedAccountId,
        expires_in_mins: expiresInMins,
        language,
        redirect_url: redirectUrl,
        metadata,
      } = parsedBody.data;

      if (linkedAccountId) {
        const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);

        if (!linkedAccount) {
          return errorService.errorResponse(res, {
            code: ErrorCode.NotFound,
            message: 'Can not re-link account: Linked account not found',
          });
        }

        if (linkedAccount.integration_key !== integration) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: `Linked account ${linkedAccountId} must re-link to ${linkedAccount.integration_key}`,
          });
        }
      }

      const minMinutes = 30;
      const maxMinutes = 10080;
      const defaultMinutes = 60;

      if (expiresInMins && (expiresInMins < minMinutes || expiresInMins > maxMinutes)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid expires_in_mins',
        });
      }

      const expiresAt = expiresInMins
        ? now() + expiresInMins * defaultMinutes
        : now() + minMinutes * defaultMinutes;

      if (language && SUPPORTED_LANGUAGES.indexOf(language) === -1) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: `Unsupported language ${language}`,
        });
      }

      if (redirectUrl) {
        try {
          new URL(redirectUrl);
        } catch {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid redirect URL',
          });
        }
      }

      const linkToken = await linkTokenService.createLinkToken({
        id: generateId(Resource.LinkToken),
        environment_id: environmentId,
        integration_key: integration || null,
        linked_account_id: linkedAccountId || null,
        expires_at: expiresAt,
        language: language || 'en',
        redirect_url: redirectUrl || null,
        metadata: metadata || null,
        can_choose_integration: !integration,
        consent_given: false,
        consent_timestamp: null,
        configuration: null,
        code_verifier: null,
        prefers_dark_mode: false,
        request_token_secret: null,
        websocket_client_id: null,
        link_method: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const activityId = await activityService.createActivity({
        id: generateId(Resource.Activity),
        environment_id: linkToken.environment_id,
        integration_key: linkToken.integration_key,
        linked_account_id: null,
        link_token_id: linkToken.id,
        action_key: null,
        collection_key: null,
        level: LogLevel.Info,
        action: LogAction.Link,
        timestamp: now(),
      });

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Link token created',
        timestamp: now(),
        payload: {
          token: linkToken.id,
          url: this.buildLinkTokenUrl(linkToken.id),
          expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
          integration: linkToken.integration_key,
          redirect_url: linkToken.redirect_url,
          language: linkToken.language,
          metadata: linkToken.metadata,
        },
      });

      const linkTokenObject: LinkTokenObject = {
        object: 'link_token',
        token: linkToken.id,
        url: this.buildLinkTokenUrl(linkToken.id),
        expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
        integration: linkToken.integration_key,
        linked_account: linkToken.linked_account_id,
        redirect_url: linkToken.redirect_url,
        language: linkToken.language,
        metadata: linkToken.metadata as Metadata,
        created_at: linkToken.created_at,
      };

      res.status(201).send(linkTokenObject);
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

      const linkTokenObjects: LinkTokenObject[] = linkTokens.map((linkToken) => {
        return {
          object: 'link_token',
          token: linkToken.id,
          url: this.buildLinkTokenUrl(linkToken.id),
          expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
          integration: linkToken.integration_key,
          linked_account: linkToken.linked_account_id,
          redirect_url: linkToken.redirect_url,
          language: linkToken.language,
          metadata: linkToken.metadata as Metadata,
          created_at: linkToken.created_at,
        };
      });

      res.status(200).json({
        object: 'list',
        data: linkTokenObjects,
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
      const linkTokenId = req.params['link_token_id'];
      if (!linkTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Token missing',
        });
      }

      const linkToken = await linkTokenService.getLinkTokenById(linkTokenId);
      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Link token not found',
        });
      }

      const linkTokenObject: LinkTokenObject = {
        object: 'link_token',
        token: linkToken.id,
        url: this.buildLinkTokenUrl(linkToken.id),
        expires_in_mins: this.expiresInMinutes(linkToken.expires_at),
        integration: linkToken.integration_key,
        linked_account: linkToken.linked_account_id,
        redirect_url: linkToken.redirect_url,
        language: linkToken.language,
        metadata: linkToken.metadata as Metadata,
        created_at: linkToken.created_at,
      };

      res.status(200).send(linkTokenObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteLinkToken(req: Request, res: Response) {
    try {
      const linkTokenId = req.params['link_token_id'];
      if (!linkTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Token missing',
        });
      }

      const deletedLinkToken = await linkTokenService.deleteLinkToken(linkTokenId);
      if (!deletedLinkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const linkTokenDeletedObject: LinkTokenDeletedObject = {
        object: 'link_token.deleted',
        token: deletedLinkToken.id,
        deleted: true,
      };

      res.status(200).send(linkTokenDeletedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private buildLinkTokenUrl(token: string) {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
      throw new Error('Server URL is not defined');
    }

    return `${serverUrl}/link/${token}`;
  }

  private expiresInMinutes(expiresAt: number) {
    return Math.floor((expiresAt - now()) / 60);
  }
}

export default new LinkTokenController();
