import type { Integration, SyncModel } from '@prisma/client';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { now } from '../utils/helpers';
import { prisma } from '../utils/prisma';
import errorService from './error.service';
import providerService from './provider.service';

class IntegrationService {
  public async createIntegration(integration: Integration): Promise<Integration | null> {
    try {
      return await prisma.integration.create({
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
          sync_frequency: 'daily',
          oauth_client_id: null,
          oauth_client_secret: null,
          oauth_scopes: null,
          rank: index + 1,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        };
      });

      const integrations = await prisma.integration.createMany({
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
      return await prisma.integration.findUnique({
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
      const integration = await prisma.integration.findUnique({
        where: {
          provider_environment_id: {
            provider: integrationProvider,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        select: { sync_models: true },
      });

      return integration ? integration.sync_models : null;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listIntegrations(environmentId: string): Promise<Integration[] | null> {
    try {
      return await prisma.integration.findMany({
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
      const result = await prisma.$transaction(
        ranks.map((integration) => {
          return prisma.integration.update({
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
      const integrations = await prisma.integration.findMany({
        where: {
          environment_id: environmentId,
          deleted_at: null,
          is_enabled: false,
        },
      });

      const result = await prisma.$transaction(
        integrations.map((integration) => {
          return prisma.integration.update({
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
      const integrations = await prisma.integration.findMany({
        where: {
          environment_id: environmentId,
          deleted_at: null,
          is_enabled: true,
        },
      });

      const result = await prisma.$transaction(
        integrations.map((integration) => {
          return prisma.integration.update({
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
      return await prisma.integration.update({
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
