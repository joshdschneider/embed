import { OAuth2, OAuthAuthorizationMethod, OAuthBodyFormat } from '@kit/providers';
import type { Integration } from '@kit/shared';
import { integrationService } from '@kit/shared';
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

  const headers = { 'User-Agent': 'Kit' };
  const { client_id, client_secret } = integrationService.loadClientCredentials(integration);

  return {
    client: {
      id: client_id,
      secret: client_secret,
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
