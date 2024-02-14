import type { ProviderSpecification } from '@kit/providers';
import type { Integration } from '@kit/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  errorService,
  getServerUrl,
  providerService,
} from '@kit/shared';
import type { Request, Response } from 'express';
import environmentService from '../services/environment.service';
import integrationService from '../services/integration.service';
import { DEFAULT_BRANDING } from '../utils/constants';
import type { ConsentTemplateData, ErrorTemplateData, ListTemplateData } from '../utils/types';

class LinkPreviewController {
  public async listView(req: Request, res: Response) {
    const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
    const prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    const override = req.query['branding'];
    let branding;

    try {
      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        throw new Error(`Failed to retrieve environment ${environmentId}`);
      }

      branding = environment.branding;
      if (override && typeof override === 'string') {
        try {
          branding = JSON.parse(override);
        } catch {}
      }

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
          logo_url: integration.provider_spec.logo_url,
          logo_dark_url: integration.provider_spec.logo_dark_url,
        };
      });

      const data: ListTemplateData = {
        is_preview: true,
        server_url: serverUrl,
        link_token: '_',
        integrations: integrationsList,
        branding,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('list', data);
    } catch (err) {
      await errorService.reportError(err);

      const data: ErrorTemplateData = {
        error_message: DEFAULT_ERROR_MESSAGE,
        branding: branding || DEFAULT_BRANDING,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('error', data);
    }
  }

  public async consentView(req: Request, res: Response) {
    const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
    const prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    const integrationProvider = req.params['integration'];
    const override = req.query['branding'];
    let branding;

    try {
      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        throw new Error(`Failed to retrieve environment ${environmentId}`);
      }

      branding = environment.branding;
      if (override && typeof override === 'string') {
        try {
          branding = JSON.parse(override);
        } catch {}
      }

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      if (!integrationProvider) {
        const data: ErrorTemplateData = {
          error_message: 'No integration selected',
          branding,
          prefers_dark_mode: prefersDarkMode,
        };

        return res.render('error', data);
      }

      const integration = await integrationService.getIntegrationByProvider(
        integrationProvider,
        environment.id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve integration ${integrationProvider}`);
      }

      if (!integration.is_enabled) {
        const data: ErrorTemplateData = {
          error_message: 'Integration is disabled',
          branding,
          prefers_dark_mode: prefersDarkMode,
        };

        return res.render('error', data);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      const data: ConsentTemplateData = {
        is_preview: true,
        server_url: serverUrl,
        link_token: '_',
        can_choose_integration: true,
        integration: {
          provider: integration.provider,
          display_name: providerSpec.display_name,
          logo_url: providerSpec.logo_url,
          logo_dark_url: providerSpec.logo_dark_url,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('consent', data);
    } catch (err) {
      await errorService.reportError(err);

      const data: ErrorTemplateData = {
        error_message: DEFAULT_ERROR_MESSAGE,
        branding: branding || DEFAULT_BRANDING,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('error', data);
    }
  }
}

export default new LinkPreviewController();
