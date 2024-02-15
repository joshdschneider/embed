import type { Integration, SyncModel } from '@kit/shared';
import { database, errorService, now, providerService } from '@kit/shared';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

class IntegrationService {
  public async createIntegration(integration: Integration): Promise<Integration | null> {
    try {
      return await database.integration.create({
        data: integration,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createInitialIntegrations(environmentId: string): Promise<number | null> {
    try {
      const providers = await providerService.listProviders();
      if (!providers) {
        return null;
      }

      const providerIntegrations: Integration[] = providers.map((provider, index) => {
        return {
          provider: provider.slug,
          environment_id: environmentId,
          is_enabled: true,
          use_client_credentials: false,
          oauth_client_id: null,
          oauth_client_secret: null,
          oauth_scopes: null,
          rank: index + 1,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        };
      });

      const integrations = await database.integration.createMany({
        data: [...providerIntegrations],
      });

      return integrations.count;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getIntegrationByProvider(
    integrationProvider: string,
    environmentId: string
  ): Promise<Integration | null> {
    try {
      return await database.integration.findUnique({
        where: {
          provider_environment_id: {
            provider: integrationProvider,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getIntegrationSyncModels(
    integrationProvider: string,
    environmentId: string
  ): Promise<SyncModel[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          provider_environment_id: {
            provider: integrationProvider,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        select: { sync_models: true },
      });

      if (!integration) {
        throw new Error(
          `Integration ${integrationProvider} not found in environment ${environmentId}`
        );
      }

      return integration.sync_models;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listIntegrations(environmentId: string): Promise<Integration[] | null> {
    try {
      return await database.integration.findMany({
        where: { environment_id: environmentId, deleted_at: null },
        orderBy: { rank: 'asc' },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async rerankIntegrations(
    environmentId: string,
    ranks: { provider: string; rank: number }[]
  ): Promise<Integration[] | null> {
    try {
      const result = await database.$transaction(
        ranks.map((integration) => {
          return database.integration.update({
            where: {
              provider_environment_id: {
                provider: integration.provider,
                environment_id: environmentId,
              },
              deleted_at: null,
            },
            data: { rank: integration.rank },
          });
        })
      );

      return result;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async enableAllIntegrations(environmentId: string) {
    try {
      const integrations = await database.integration.findMany({
        where: {
          environment_id: environmentId,
          deleted_at: null,
          is_enabled: false,
        },
      });

      const result = await database.$transaction(
        integrations.map((integration) => {
          return database.integration.update({
            where: {
              provider_environment_id: {
                provider: integration.provider,
                environment_id: environmentId,
              },
              deleted_at: null,
            },
            data: { is_enabled: true },
          });
        })
      );

      return result;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async disableAllIntegrations(environmentId: string) {
    try {
      const integrations = await database.integration.findMany({
        where: {
          environment_id: environmentId,
          deleted_at: null,
          is_enabled: true,
        },
      });

      const result = await database.$transaction(
        integrations.map((integration) => {
          return database.integration.update({
            where: {
              provider_environment_id: {
                provider: integration.provider,
                environment_id: environmentId,
              },
              deleted_at: null,
            },
            data: { is_enabled: false },
          });
        })
      );

      return result;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
  public async updateIntegration(
    integrationProvider: string,
    environmentId: string,
    data: Partial<Integration>
  ): Promise<Integration | null> {
    try {
      return await database.integration.update({
        where: {
          provider_environment_id: {
            provider: integrationProvider,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public loadClientCredentials(integration: Integration): {
    client_id: string;
    client_secret: string;
  } {
    if (integration.use_client_credentials) {
      if (!integration.oauth_client_id || !integration.oauth_client_secret) {
        throw new Error('Client credentials are missing');
      }

      return {
        client_id: integration.oauth_client_id,
        client_secret: integration.oauth_client_secret,
      };
    }

    const filePath = path.join(__dirname, '../../credentials.yaml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const credentials = yaml.load(fileContents) as {
      [key: string]: { client_id: string; client_secret: string };
    };

    const defaultProviderCredentials = credentials[integration.provider];
    if (!defaultProviderCredentials) {
      throw new Error(`Failed to load default credentials for ${integration.provider}`);
    }

    return defaultProviderCredentials;
  }
}

export default new IntegrationService();
