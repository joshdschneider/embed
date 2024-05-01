import { Action, Integration } from '@prisma/client';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';

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

  public async getIntegrationById(integrationId: string): Promise<Integration | null> {
    try {
      const integration = await database.integration.findUnique({
        where: { id: integrationId, deleted_at: null },
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

  public async getIntegrationActions(integrationId: string): Promise<Action[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: { id: integrationId, deleted_at: null },
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
      });

      return integrations.map((i) => encryptionService.decryptIntegration(i));
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateIntegration(
    integrationId: string,
    data: Partial<Integration>
  ): Promise<Integration | null> {
    try {
      const integration = await database.integration.update({
        where: { id: integrationId, deleted_at: null },
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
    if (!integration.is_using_test_credentials) {
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

    const defaultProviderCredentials = credentials[integration.provider_key];
    if (!defaultProviderCredentials) {
      throw new Error(`Failed to load default credentials for ${integration.provider_key}`);
    }

    return defaultProviderCredentials;
  }
}

export default new IntegrationService();
