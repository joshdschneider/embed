import { AuthScheme, OAuth2, OAuthAuthorizationMethod, OAuthBodyFormat } from '@embed/providers';
import type { Connection, Integration } from '@prisma/client';
import { AuthorizationCode } from 'simple-oauth2';
import integrationService from '../services/integration.service';
import { interpolateString } from '../utils/helpers';
import type { OAuth1Credentials, OAuth2Credentials } from '../utils/types';

export function getSimpleOAuth2ClientConfig(
  integration: Integration,
  specification: OAuth2,
  configuration: Record<string, string>
) {
  const strippedAuthorizeUrl = specification.authorization_url.replace(/configuration\./g, '');
  const authorizeUrl = new URL(interpolateString(strippedAuthorizeUrl, configuration));
  const strippedTokenUrl = specification.token_url.replace(/configuration\./g, '');
  const tokenUrl = new URL(interpolateString(strippedTokenUrl, configuration));

  const headers = { 'User-Agent': 'Embed' };
  const { oauth_client_id, oauth_client_secret } =
    integrationService.getIntegrationOauthCredentials(integration);

  return {
    client: {
      id: oauth_client_id,
      secret: oauth_client_secret,
    },
    auth: {
      tokenHost: tokenUrl.origin,
      tokenPath: tokenUrl.pathname,
      authorizeHost: authorizeUrl.origin,
      authorizePath: authorizeUrl.pathname,
    },
    http: { headers: headers },
    options: {
      authorizationMethod: specification.authorization_method || OAuthAuthorizationMethod.BODY,
      bodyFormat: specification.body_format || OAuthBodyFormat.FORM,
      scopeSeparator: specification.scope_separator || ' ',
    },
  };
}

export async function getFreshOAuth2Credentials(
  integration: Integration,
  specification: OAuth2,
  connection: Connection
): Promise<OAuth2Credentials> {
  const configObj = (connection.configuration as Record<string, string>) || {};
  const config = getSimpleOAuth2ClientConfig(integration, specification, configObj);

  if (specification.token_request_auth_method === 'basic') {
    const headers = {
      ...config.http.headers,
      Authorization:
        'Basic ' + Buffer.from(config.client.id + ':' + config.client.secret).toString('base64'),
    };

    config.http.headers = headers;
  }

  const client = new AuthorizationCode(config);
  const credentials = JSON.parse(connection.credentials);

  const oldAccessToken = client.createToken({
    access_token: credentials.access_token,
    expires_at: credentials.expires_at,
    refresh_token: credentials.refresh_token,
  });

  let additionalParams = {};
  if (specification.refresh_params) {
    additionalParams = specification.refresh_params;
  } else if (specification.token_params) {
    additionalParams = specification.token_params;
  }

  const rawNewAccessToken = await oldAccessToken.refresh(additionalParams);
  const newCredentials = parseRawCredentials(
    rawNewAccessToken.token,
    AuthScheme.OAuth2
  ) as OAuth2Credentials;

  if (!newCredentials.refresh_token && credentials.refresh_token != null) {
    newCredentials.refresh_token = credentials.refresh_token;
  }

  return newCredentials;
}

export function parseRawCredentials(credentials: Record<string, any>, authScheme: AuthScheme) {
  if (authScheme === AuthScheme.OAuth2) {
    if (!credentials['access_token']) {
      throw new Error(`Incomplete raw credentials`);
    }

    let expiresAt: Date | undefined;
    if (credentials['expires_at']) {
      expiresAt = parseTokenExpiration(credentials['expires_at']);
    } else if (credentials['expires_in']) {
      expiresAt = new Date(Date.now() + Number.parseInt(credentials['expires_in'], 10) * 1000);
    }

    const oauth2Credentials: OAuth2Credentials = {
      type: AuthScheme.OAuth2,
      access_token: credentials['access_token'],
      refresh_token: credentials['refresh_token'],
      expires_at: expiresAt,
      raw: credentials,
    };

    return oauth2Credentials;
  } else if (authScheme === AuthScheme.OAuth1) {
    if (!credentials['oauth_token'] || !credentials['oauth_token_secret']) {
      throw new Error(`Incomplete raw credentials`);
    }

    const oauth1Credentials: OAuth1Credentials = {
      type: AuthScheme.OAuth1,
      oauth_token: credentials['oauth_token'],
      oauth_token_secret: credentials['oauth_token_secret'],
      raw: credentials,
    };

    return oauth1Credentials;
  } else {
    throw new Error('Failed to parse OAuth credentials');
  }
}

export function parseTokenExpiration(expirationDate: any): Date {
  if (expirationDate instanceof Date) {
    return expirationDate;
  }

  if (typeof expirationDate === 'number') {
    return new Date(expirationDate * 1000);
  }

  return new Date(expirationDate);
}
