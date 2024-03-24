import { Action, Collection, Integration } from '@prisma/client';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { DEFAULT_AUTO_START_SYNC, DEFAULT_SYNC_FREQUENCY } from '../utils/constants';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import environmentService from './environment.service';
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

  public async seedIntegrations(environmentId: string): Promise<{
    integrations_added: number;
    collections_added: number;
    actions_added: number;
  } | null> {
    try {
      const providers = await providerService.listProviders();
      if (!providers) {
        throw new Error('Failed to list providers');
      }

      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        throw new Error('Environment not found');
      }

      const integrationCount = await database.integration.count();
      let rank = integrationCount;

      let integrationsAdded = 0;
      let collectionsAdded = 0;
      let actionsAdded = 0;

      for (const provider of providers) {
        let integration: Integration & {
          collections: Collection[];
          actions: Action[];
        };

        const existingIntegration = await database.integration.findUnique({
          where: {
            unique_key_environment_id: {
              unique_key: provider.unique_key,
              environment_id: environmentId,
            },
          },
          include: { collections: true, actions: true },
        });

        if (existingIntegration) {
          integration = existingIntegration;
        } else {
          integration = await database.integration.create({
            data: {
              unique_key: provider.unique_key,
              name: provider.name,
              environment_id: environmentId,
              is_enabled: environment.enable_new_integrations,
              use_oauth_credentials: false,
              oauth_client_id: null,
              oauth_client_secret: null,
              oauth_client_secret_iv: null,
              oauth_client_secret_tag: null,
              additional_scopes: null,
              rank,
              created_at: now(),
              updated_at: now(),
              deleted_at: null,
            },
            include: { collections: true, actions: true },
          });

          rank++;
          integrationsAdded++;
        }

        const collectionKeys = integration.collections.map((collection) => collection.unique_key);
        const collectionEntries = Object.entries(provider.collections || {});
        const filteredCollectionEntries = collectionEntries.filter(
          ([k, v]) => !collectionKeys.includes(k)
        );

        const collections: Collection[] = filteredCollectionEntries.map(([k, v]) => {
          return {
            unique_key: k,
            integration_key: provider.unique_key,
            environment_id: environmentId,
            is_enabled: v.default_enabled || false,
            default_sync_frequency: v.default_sync_frequency || DEFAULT_SYNC_FREQUENCY,
            auto_start_sync: v.default_auto_start_sync || DEFAULT_AUTO_START_SYNC,
            exclude_properties_from_sync: [],
            text_embedding_model: '', // TODO
            multimodal_embedding_model: '', // TODO
            has_multimodal_properties: v.has_multimodal_properties,
            has_references: v.has_references,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          };
        });

        if (collections.length > 0) {
          const createdCollections = await database.collection.createMany({
            data: [...collections],
          });

          collectionsAdded += createdCollections.count;
        }

        const actionKeys = integration.actions.map((action) => action.unique_key);
        const actionEntries = Object.entries(provider.actions || {});
        const filteredActionEntries = actionEntries.filter(([k, v]) => !actionKeys.includes(k));

        const actions: Action[] = filteredActionEntries.map(([k, v]) => {
          return {
            unique_key: k,
            integration_key: provider.unique_key,
            environment_id: environmentId,
            is_enabled: v.default_enabled || false,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          };
        });

        if (actions.length > 0) {
          const createdActions = await database.action.createMany({
            data: [...actions],
          });

          actionsAdded += createdActions.count;
        }
      }

      return {
        integrations_added: integrationsAdded,
        collections_added: collectionsAdded,
        actions_added: actionsAdded,
      };
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
