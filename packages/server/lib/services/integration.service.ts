import type { Integration } from '@prisma/client';
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
          provider: integrationProvider,
          environment_id: environmentId,
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listIntegrations(environmentId: string): Promise<Integration[] | null> {
    try {
      return await prisma.integration.findMany({
        where: { environment_id: environmentId, deleted_at: null },
        orderBy: { rank: 'desc' },
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
              environment_id: environmentId,
              provider: integration.provider,
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
              provider: integration.provider,
              environment_id: environmentId,
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
              provider: integration.provider,
              environment_id: environmentId,
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
          provider: integrationProvider,
          environment_id: environmentId,
          deleted_at: null,
        },
        data,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new IntegrationService();
