import { AuthScheme, OAuth1, OAuth2 } from '@beta/providers';
import { Integration, LinkToken } from '@prisma/client';
import crypto from 'crypto';
import { Request, Response } from 'express';
import SimpleOAuth2 from 'simple-oauth2';
import { OAuth1Client } from '../clients/oauth1.client';
import { getSimpleOAuth2ClientConfig } from '../clients/oauth2.client';
import activityService from '../services/activity.service';
import errorService, { ErrorCode } from '../services/error.service';
import integrationService from '../services/integration.service';
import linkTokenService from '../services/linkToken.service';
import providerService from '../services/provider.service';
import { LogLevel } from '../types';
import { DEFAULT_ERROR_MESSAGE } from '../utils/constants';
import {
  extractConfigurationKeys,
  getOauthCallbackUrl,
  missesInterpolationParam,
  now,
} from '../utils/helpers';

class OAuthController {
  public async authorize(req: Request, res: Response) {
    const token = req.query['token'];

    if (!token || typeof token !== 'string') {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Link token missing or invalid',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
        });
      }

      const integration = await integrationService.getIntegrationByProvider(
        linkToken.integration_provider,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error('Failed to retrieve integration');
      } else if (!integration.is_enabled) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration is disabled',
        });

        return res.render('error', {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider);

      if (!provider) {
        throw new Error('Failed to retrieve provider specification');
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Initiating OAuth authorization flow for ${provider.display_name}`,
      });

      const updatedLinkToken = await linkTokenService.updateLinkToken(
        linkToken.id,
        linkToken.environment_id,
        {
          code_verifier: crypto.randomBytes(24).toString('hex'),
          updated_at: now(),
        }
      );

      if (!updatedLinkToken) {
        throw new Error('Failed to update link token');
      }

      if (provider.auth.scheme === AuthScheme.OAUTH2) {
        return this.oauth2Request(res, {
          authSpec: provider.auth as OAuth2,
          integration,
          linkToken: updatedLinkToken,
          activityId,
        });
      } else if (provider.auth.scheme === AuthScheme.OAUTH1) {
        return this.oauth1Request(res, {
          authSpec: provider.auth as OAuth1,
          integration,
          linkToken: updatedLinkToken,
          activityId,
        });
      } else {
        throw new Error('Invalid auth scheme');
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private async oauth2Request(
    res: Response,
    {
      linkToken,
      authSpec,
      integration,
      activityId,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth2;
      integration: Integration;
      activityId: string | null;
    }
  ) {
    try {
      if (integration.use_client_credentials) {
        if (
          integration.oauth_client_id == null ||
          integration.oauth_client_secret == null ||
          integration.oauth_scopes == null
        ) {
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Error,
            message: `OAuth client credentials missing for ${integration.provider}`,
          });

          return res.render('error', {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }
      }

      const authorizationUrlKeys = extractConfigurationKeys(authSpec.authorization_url);
      const tokenUrlKeys = extractConfigurationKeys(authSpec.token_url);
      if (authorizationUrlKeys.length > 0 || tokenUrlKeys.length > 0) {
        if (
          !linkToken.configuration ||
          missesInterpolationParam(
            authSpec.authorization_url,
            linkToken.configuration as Record<string, string>
          ) ||
          missesInterpolationParam(
            authSpec.token_url,
            linkToken.configuration as Record<string, string>
          )
        ) {
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Error,
            message: 'Missing configuration fields',
            payload: {
              authorization_url: authSpec.authorization_url,
              token_url: authSpec.token_url,
              configuration: linkToken.configuration,
            },
          });

          return res.render('error', {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }
      }

      if (
        authSpec.token_params == undefined ||
        authSpec.token_params.grant_type == undefined ||
        authSpec.token_params.grant_type == 'authorization_code'
      ) {
        let authParams: Record<string, string | undefined> = authSpec.authorization_params || {};

        if (!authSpec.disable_pkce) {
          const h = crypto
            .createHash('sha256')
            .update(linkToken.code_verifier!)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          authParams['code_challenge'] = h;
          authParams['code_challenge_method'] = 'S256';
        }

        Object.keys(authParams).forEach((key) =>
          authParams[key] === undefined ? delete authParams[key] : {}
        );

        const callbackUrl = getOauthCallbackUrl();
        const scopes = integration.oauth_scopes
          ? integration.oauth_scopes.split(',').join(authSpec.scope_separator || ' ')
          : '';

        const simpleOAuth2ClientConfig = getSimpleOAuth2ClientConfig(
          integration,
          authSpec,
          linkToken.configuration as Record<string, string>
        );

        const authorizationCode = new SimpleOAuth2.AuthorizationCode(simpleOAuth2ClientConfig);

        const authorizationUri = authorizationCode.authorizeURL({
          redirect_uri: callbackUrl,
          scope: scopes,
          state: linkToken.id,
          ...authParams,
        });

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: `Redirecting to ${integration.provider} OAuth authorization URL`,
          payload: { authorization_url: authorizationUri },
        });

        res.redirect(authorizationUri);
      } else {
        throw new Error(`Unsupported grant type: ${authSpec.token_params.grant_type}`);
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private async oauth1Request(
    res: Response,
    {
      linkToken,
      authSpec,
      integration,
      activityId,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth1;
      integration: Integration;
      activityId: string | null;
    }
  ) {
    try {
      const callbackUrl = getOauthCallbackUrl();
      const callbackParams = new URLSearchParams({ state: linkToken.id });
      const oauth1CallbackURL = `${callbackUrl}?${callbackParams.toString()}`;

      const oauth1Client = new OAuth1Client({
        integration,
        specification: authSpec,
        callbackUrl: oauth1CallbackURL,
      });

      const requestToken = await oauth1Client.getOAuthRequestToken();

      const updatedLinkToken = await linkTokenService.updateLinkToken(
        linkToken.id,
        linkToken.environment_id,
        {
          request_token_secret: requestToken.request_token_secret,
          updated_at: now(),
        }
      );

      if (!updatedLinkToken) {
        throw new Error('Failed to update link token');
      }

      const redirectUrl = oauth1Client.getAuthorizationURL(requestToken);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Redirecting to ${integration.provider} OAuth authorization URL`,
        payload: { authorization_url: redirectUrl },
      });

      return res.redirect(redirectUrl);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async callback(req: Request, res: Response) {
    const { state } = req.query;

    if (!state || typeof state !== 'string') {
      const err = new Error('Invalid state parameter received from OAuth callback');
      await errorService.reportError(err);

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(state);

    if (!linkToken) {
      const err = new Error('Failed to retrieve link token from OAuth callback');
      await errorService.reportError(err);

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (!linkToken.integration_provider) {
        throw new Error('Integration provider missing from link token');
      }

      const integration = await integrationService.getIntegrationByProvider(
        linkToken.integration_provider,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error('Failed to retrieve integration');
      }

      const provider = await providerService.getProviderSpec(linkToken.integration_provider);

      if (!provider) {
        throw new Error('Failed to retrieve provider specification');
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `OAuth callback received from ${provider.display_name}`,
      });

      const authSpec = provider.auth;
      if (authSpec.scheme === AuthScheme.OAUTH2) {
        return this.oauth2Callback(req, res, {
          linkToken,
          authSpec: authSpec as OAuth2,
          integration,
          activityId,
        });
      } else if (authSpec.scheme === AuthScheme.OAUTH1) {
        return this.oauth1Callback(req, res, {
          linkToken,
          authSpec: authSpec as OAuth1,
          integration,
          activityId,
        });
      } else {
        throw new Error('Invalid auth scheme');
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async oauth2Callback(
    req: Request,
    res: Response,
    {
      linkToken,
      authSpec,
      integration,
      activityId,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth2;
      integration: Integration;
      activityId: string | null;
    }
  ): Promise<void> {
    //..
  }

  public async oauth1Callback(
    req: Request,
    res: Response,
    {
      linkToken,
      authSpec,
      integration,
      activityId,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth1;
      integration: Integration;
      activityId: string | null;
    }
  ): Promise<void> {
    //..
  }
}

export default new OAuthController();
