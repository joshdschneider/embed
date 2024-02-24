import { Action, Integration } from '@prisma/client';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';
import providerService from './provider.service';

class IntegrationService {
  public async createIntegration(integration: Integration): Promise<Integration | null> {
    try {
      const encryptedIntegration = encryptionService.encryptIntegration(integration);

      const createdIntegration = await database.integration.create({
        data: encryptedIntegration,
      });

      return encryptionService.decryptIntegration(createdIntegration);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async seedIntegrations(environmentId: string): Promise<number | null> {
    try {
      const providers = await providerService.listProviders();

      if (!providers) {
        return null;
      }

      const providerIntegrations: Integration[] = providers.map((provider, index) => {
        return {
          unique_key: provider.unique_key,
          name: provider.name,
          environment_id: environmentId,
          is_enabled: true,
          use_oauth_credentials: false,
          oauth_client_id: null,
          oauth_client_secret: null,
          oauth_client_secret_iv: null,
          oauth_client_secret_tag: null,
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

  public async getIntegrationByKey(
    integrationKey: string,
    environmentId: string
  ): Promise<Integration | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          unique_key_environment_id: {
            unique_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
      });

      if (!integration) {
        return null;
      }

      return encryptionService.decryptIntegration(integration);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getIntegrationActions(
    integrationKey: string,
    environmentId: string
  ): Promise<Action[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          unique_key_environment_id: {
            unique_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        select: { actions: true },
      });

      if (!integration) {
        return null;
      }

      return integration.actions;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listIntegrations(environmentId: string): Promise<Integration[] | null> {
    try {
      const integrations = await database.integration.findMany({
        where: { environment_id: environmentId, deleted_at: null },
        orderBy: { rank: 'asc' },
      });

      return integrations.map((i) => encryptionService.decryptIntegration(i));
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async rerankIntegrations(
    environmentId: string,
    integrations: { unique_key: string; rank: number }[]
  ): Promise<number | null> {
    try {
      const result = await database.$transaction(
        integrations.map((i) => {
          return database.integration.update({
            where: {
              unique_key_environment_id: {
                unique_key: i.unique_key,
                environment_id: environmentId,
              },
              deleted_at: null,
            },
            data: { rank: i.rank },
          });
        })
      );

      return result.length;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateIntegration(
    integrationKey: string,
    environmentId: string,
    data: Partial<Integration>
  ): Promise<Integration | null> {
    try {
      const integration = await database.integration.update({
        where: {
          unique_key_environment_id: {
            unique_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data: { ...data, updated_at: now() },
      });

      return encryptionService.decryptIntegration(integration);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public getIntegrationOauthCredentials(integration: Integration): {
    oauth_client_id: string;
    oauth_client_secret: string;
  } {
    if (integration.use_oauth_credentials) {
      const decryptedIntegration = encryptionService.decryptIntegration(integration);

      if (!decryptedIntegration.oauth_client_id || !decryptedIntegration.oauth_client_secret) {
        throw new Error('Client credentials are missing');
      }

      return {
        oauth_client_id: decryptedIntegration.oauth_client_id,
        oauth_client_secret: decryptedIntegration.oauth_client_secret,
      };
    }

    const filePath = path.join(__dirname, '../../credentials.yaml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const credentials = yaml.load(fileContents) as {
      [key: string]: {
        oauth_client_id: string;
        oauth_client_secret: string;
      };
    };

    const defaultProviderCredentials = credentials[integration.unique_key];
    if (!defaultProviderCredentials) {
      throw new Error(`Failed to load default credentials for ${integration.unique_key}`);
    }

    return defaultProviderCredentials;
  }
}

export default new IntegrationService();
