import { ProviderSpecification } from '@beta/providers';
import { Integration } from '@prisma/client';
import { Request, Response } from 'express';
import environmentService from '../services/environment.service';
import errorService from '../services/error.service';
import integrationService from '../services/integration.service';
import providerService from '../services/provider.service';
import { BrandingOptions } from '../types';
import { DEFAULT_ERROR_MESSAGE, ENVIRONMENT_ID_LOCALS_KEY, getServerUrl } from '../utils/constants';

class LinkPreviewController {
  public async listView(req: Request, res: Response) {
    const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
    const prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    const brandingOverride = req.query['branding'];

    try {
      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        throw new Error(`Failed to retrieve environment ${environmentId}`);
      }

      let opts = environment.branding as BrandingOptions;
      if (brandingOverride && typeof brandingOverride === 'string') {
        try {
          opts = JSON.parse(brandingOverride);
        } catch {}
      }

      const darkModePreference =
        opts.appearance === 'dark' || (opts.appearance === 'system' && prefersDarkMode);
      const { light_mode, dark_mode, ...rest } = opts;
      const branding = darkModePreference ? { ...rest, ...dark_mode } : { ...rest, ...light_mode };

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integrations = await integrationService.listIntegrations(environmentId);
      if (!integrations) {
        throw new Error(`Failed to list integrations for environment ${environmentId}`);
      }

      const enabledIntegrations = integrations.filter((integration) => integration.is_enabled);

      const integrationsWithSpec = await Promise.all(
        enabledIntegrations.map(async (integration) => {
          const providerSpec = await providerService.getProviderSpec(integration.provider);
          if (!providerSpec) {
            const err = new Error(`Provider specification not found for ${integration.provider}`);
            await errorService.reportError(err);
          }
          return { ...integration, provider_spec: providerSpec };
        })
      );

      const integrationsFiltered = integrationsWithSpec.filter(
        (integration) => integration.provider_spec !== null
      ) as (Integration & { provider_spec: ProviderSpecification })[];

      const integrationsList = integrationsFiltered.map((integration) => {
        return {
          provider: integration.provider,
          display_name: integration.provider_spec.display_name,
          logo_url:
            darkModePreference && integration.provider_spec.logo_dark_url
              ? integration.provider_spec.logo_dark_url
              : integration.provider_spec.logo_url,
        };
      });

      res.render(
        'list',
        {
          is_preview: true,
          server_url: serverUrl,
          link_token: '',
          integrations: integrationsList,
          branding,
          prefers_dark_mode: darkModePreference,
        },
        (err, html) => this.safeRender(res, err, html)
      );
    } catch (err) {
      await errorService.reportError(err);

      res.render('error', { message: DEFAULT_ERROR_MESSAGE }, (err, html) => {
        this.safeRender(res, err, html);
      });
    }
  }

  public async consentView(req: Request, res: Response) {
    const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
    const prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    const integrationProvider = req.params['integration'];
    const brandingOverride = req.query['branding'];

    if (!integrationProvider) {
      return res.render('error', { message: 'No integration selected' });
    }

    try {
      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        throw new Error(`Failed to retrieve environment ${environmentId}`);
      }

      let opts = environment.branding as BrandingOptions;
      if (brandingOverride && typeof brandingOverride === 'string') {
        try {
          opts = JSON.parse(brandingOverride);
        } catch {}
      }

      const darkModePreference =
        opts.appearance === 'dark' || (opts.appearance === 'system' && prefersDarkMode);
      const { light_mode, dark_mode, ...rest } = opts;
      const branding = darkModePreference ? { ...rest, ...dark_mode } : { ...rest, ...light_mode };

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationByProvider(
        integrationProvider,
        environment.id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve integration ${integrationProvider}`);
      }

      if (!integration.is_enabled) {
        return res.render('error', { message: 'Integration is disabled' }, (err, html) => {
          this.safeRender(res, err, html);
        });
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      res.render(
        'consent',
        {
          is_preview: true,
          server_url: serverUrl,
          link_token: '',
          can_choose_integration: true,
          integration: {
            provider: integration.provider,
            display_name: providerSpec.display_name,
            logo_url:
              darkModePreference && providerSpec.logo_dark_url
                ? providerSpec.logo_dark_url
                : providerSpec.logo_url,
          },
          branding,
          prefers_dark_mode: darkModePreference,
        },
        (err, html) => this.safeRender(res, err, html)
      );
    } catch (err) {
      await errorService.reportError(err);

      res.render('error', { message: DEFAULT_ERROR_MESSAGE }, (err, html) => {
        this.safeRender(res, err, html);
      });
    }
  }

  private safeRender(res: Response, err: Error, html: string) {
    if (err) {
      errorService.reportError(err);

      res.render('error', { message: DEFAULT_ERROR_MESSAGE }, (err, html) => {
        if (err) {
          res.send(DEFAULT_ERROR_MESSAGE);
        } else {
          res.send(html);
        }
      });
    } else {
      res.send(html);
    }
  }
}

export default new LinkPreviewController();
