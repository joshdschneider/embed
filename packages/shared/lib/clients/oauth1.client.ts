import type { OAuth1 as OAuth1Spec } from '@embed/providers';
import type { Integration } from '@prisma/client';
import OAuth1 from 'oauth';
import integrationService from '../services/integration.service';

export type OAuth1RequestTokenResult = {
  request_token: string;
  request_token_secret: string;
  parsed_query_string: any;
};

type OAuth1ClientOptions = {
  integration: Integration;
  specification: OAuth1Spec;
  scopes: string;
  callbackUrl?: string;
};

export class OAuth1Client {
  private client: OAuth1.OAuth;
  private specification: OAuth1Spec;
  private scopes: string;

  constructor({ integration, specification, scopes, callbackUrl }: OAuth1ClientOptions) {
    this.specification = specification;
    this.scopes = scopes;

    const headers = { 'User-Agent': 'Embed' };
    const { oauth_client_id, oauth_client_secret } =
      integrationService.getIntegrationOauthCredentials(integration);

    this.client = new OAuth1.OAuth(
      this.specification.request_url,
      this.specification.token_url,
      oauth_client_id,
      oauth_client_secret,
      '1.0A',
      callbackUrl || null,
      this.specification.signature_method,
      undefined,
      headers
    );

    this.client.setClientOptions({
      requestTokenHttpMethod: this.specification.request_http_method || 'POST',
      accessTokenHttpMethod: this.specification.token_http_method || 'POST',
      followRedirects: true,
    });
  }

  async getOAuthRequestToken(): Promise<OAuth1RequestTokenResult> {
    let tokenParams = {};
    if (this.specification.request_params) {
      tokenParams = this.specification.request_params;
    }

    const promise = new Promise<OAuth1RequestTokenResult>((resolve, reject) => {
      this.client.getOAuthRequestToken(
        tokenParams,
        (
          error: { statusCode: number; data?: any },
          token: any,
          token_secret: any,
          parsed_query_string: any
        ) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              request_token: token,
              request_token_secret: token_secret,
              parsed_query_string: parsed_query_string,
            });
          }
        }
      );
    });

    return promise;
  }

  async getOAuthAccessToken({
    oauthToken,
    tokenSecret,
    tokenVerifier,
  }: {
    oauthToken: string;
    tokenSecret: string;
    tokenVerifier: string;
  }): Promise<any> {
    let tokenParams = {};
    if (this.specification.token_params) {
      tokenParams = this.specification.token_params;
    }

    return new Promise<any>((resolve, reject) => {
      // @ts-ignore
      tokenParams['oauth_verifier'] = tokenVerifier;

      // @ts-ignore
      this.client._performSecureRequest(
        oauthToken,
        tokenSecret,
        // @ts-ignore
        this.client._clientOptions.accessTokenHttpMethod,
        // @ts-ignore
        this.client._accessUrl,
        tokenParams,
        null,
        undefined,
        function (error, data, _response) {
          if (error) {
            reject(error);
          } else {
            // @ts-ignore
            const queryParams = new URLSearchParams(data);
            const parsedFull = {};
            for (const pair of queryParams) {
              // @ts-ignore
              parsedFull[pair[0]] = pair[1];
            }

            resolve(parsedFull);
          }
        }
      );
    });
  }

  getAuthorizationURL(requestToken: OAuth1RequestTokenResult) {
    let authParams = {};
    if (this.specification.authorization_params) {
      authParams = this.specification.authorization_params;
    }

    const queryParams = {
      oauth_token: requestToken.request_token,
      scope: this.scopes,
      ...authParams,
    };

    const url = new URL(this.specification.authorization_url);
    const params = new URLSearchParams(queryParams);
    return `${url}?${params.toString()}`;
  }
}
