import { Environment } from '@prisma/client';
import { DEFAULT_BRANDING } from '../utils/constants';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import { Branding } from '../utils/types';
import encryptionService from './encryption.service';
import errorService from './error.service';

class EnvironmentService {
  public async listEnvironments(organizationId: string): Promise<Environment[] | null> {
    try {
      return await database.environment.findMany({ where: { organization_id: organizationId } });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createEnvironment(environment: Environment): Promise<Environment | null> {
    try {
      return await database.environment.create({
        data: { ...environment, branding: environment.branding || DEFAULT_BRANDING },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getEnvironmentById(environmentId: string): Promise<Environment | null> {
    try {
      return await database.environment.findUnique({ where: { id: environmentId } });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getEnvironmentByApiKey(key: string): Promise<Environment | null> {
    try {
      const keyHash = encryptionService.hashString(key);
      const apiKey = await database.apiKey.findUnique({
        where: { key_hash: keyHash },
        include: { environment: true },
      });

      if (!apiKey) {
        return null;
      }

      const { environment } = apiKey;
      return environment;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async findOrganizationEnvironment(
    organizationId: string,
    environmentId: string
  ): Promise<Environment | null> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId },
        include: { environments: true },
      });

      if (!organization) {
        return null;
      }

      const environment = organization.environments.find((env) => env.id === environmentId);
      if (!environment) {
        return null;
      }

      return environment;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateEnvironment(
    environmentId: string,
    environment: Partial<Environment>
  ): Promise<Environment | null> {
    try {
      return await database.environment.update({
        where: { id: environmentId },
        data: {
          type: environment.type || undefined,
          auto_enable_actions: environment.auto_enable_actions ?? undefined,
          auto_enable_collections: environment.auto_enable_collections ?? undefined,
          auto_start_syncs: environment.auto_start_syncs ?? undefined,
          default_sync_frequency: environment.default_sync_frequency || undefined,
          default_multimodal_embedding_model:
            environment.default_multimodal_embedding_model || undefined,
          default_text_embedding_model: environment.default_text_embedding_model || undefined,
          multimodal_enabled_by_default: environment.multimodal_enabled_by_default ?? undefined,
          branding: environment.branding || undefined,
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getEnvironmentBranding(environmentId: string): Promise<Branding> {
    try {
      const environment = await this.getEnvironmentById(environmentId);
      if (!environment) {
        return DEFAULT_BRANDING;
      }

      return environment.branding as Branding;
    } catch (err) {
      await errorService.reportError(err);
      return DEFAULT_BRANDING;
    }
  }
}

export default new EnvironmentService();
