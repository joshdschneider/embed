import { ApiKey, Environment } from '@prisma/client';
import { Branding, BrandingOptions } from '../types';
import { DEFAULT_BRANDING } from '../utils/constants';
import { prisma } from '../utils/prisma';
import encryptionService from './encryption.service';
import errorService from './error.service';

class EnvironmentService {
  public async createEnvironment(environment: Environment): Promise<Environment | null> {
    try {
      return await prisma.environment.create({
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
      return await prisma.environment.findUnique({
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
      const apiKey = await prisma.apiKey.findUnique({
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
      const user = await prisma.user.findUnique({
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
      return await prisma.environment.update({
        where: { id: environmentId },
        data: {
          enable_new_integrations: environment.enable_new_integrations,
          branding: environment.branding || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getEnvironmentBranding(
    environmentId: string,
    prefersDarkMode?: boolean
  ): Promise<Branding> {
    try {
      const environment = await this.getEnvironmentById(environmentId);
      if (environment) {
        const { light_mode, dark_mode, ...rest } = environment.branding as BrandingOptions;
        return prefersDarkMode ? { ...rest, ...dark_mode } : { ...rest, ...light_mode };
      }
    } catch (err) {
      await errorService.reportError(err);
    }

    const { light_mode, dark_mode, ...rest } = DEFAULT_BRANDING;
    return prefersDarkMode ? { ...rest, ...dark_mode } : { ...rest, ...light_mode };
  }
}

export default new EnvironmentService();
