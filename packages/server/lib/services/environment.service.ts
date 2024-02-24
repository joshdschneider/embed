import type { ApiKey, Environment } from '@kit/shared';
import { database, encryptionService, errorService, now } from '@kit/shared';
import { DEFAULT_BRANDING } from '../utils/constants';
import type { Branding } from '../utils/types';

class EnvironmentService {
  public async createEnvironment(environment: Environment): Promise<Environment | null> {
    try {
      return await database.environment.create({
        data: {
          ...environment,
          branding: environment.branding || DEFAULT_BRANDING,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getEnvironmentById(environmentId: string): Promise<Environment | null> {
    try {
      return await database.environment.findUnique({
        where: { id: environmentId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getEnvironmentByApiKey(key: string): Promise<Environment | null> {
    try {
      const { key: encryptedApiKey } = encryptionService.encryptApiKey({ key } as ApiKey);
      const apiKey = await database.apiKey.findUnique({
        where: { key: encryptedApiKey },
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

  public async findUserEnvironment(
    userId: string,
    environmentId: string
  ): Promise<Environment | null> {
    try {
      const user = await database.user.findUnique({
        where: { id: userId },
        include: { account: { include: { environments: true } } },
      });

      if (!user) {
        return null;
      }

      const environment = user.account.environments.find((env) => env.id === environmentId);
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
          enable_new_integrations: environment.enable_new_integrations,
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
