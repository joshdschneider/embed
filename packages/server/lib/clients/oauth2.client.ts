import { OAuth2, OAuthAuthorizationMethod, OAuthBodyFormat } from '@embed/providers';
import type { Integration } from '@embed/shared';
import { integrationService } from '@embed/shared';
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
