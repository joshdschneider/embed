import { OAuth2, OAuthAuthorizationMethod, OAuthBodyFormat } from '@beta/providers';
import type { Integration } from '@prisma/client';
import { interpolateString } from '../utils/helpers';

export function getSimpleOAuth2ClientConfig(
  integration: Integration,
  specification: OAuth2,
  configuration: Record<string, string>
) {
  const strippedAuthorizeUrl = specification.authorization_url.replace(/configuration\./g, '');
  const authorizeUrl = new URL(interpolateString(strippedAuthorizeUrl, configuration));
  const strippedTokenUrl = specification.token_url.replace(/configuration\./g, '');
  const tokenUrl = new URL(interpolateString(strippedTokenUrl, configuration));

  const headers = {
    'User-Agent': 'Beta',
  };

  const client = {
    id: integration.oauth_client_id!,
    secret: integration.oauth_client_secret!,
  };

  if (!integration.use_client_credentials) {
    client.id = 'todo: get default client id';
    client.secret = 'todo: get default client secret';
  }

  return {
    client: client,
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
