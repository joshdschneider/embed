import { ApiKey } from '@prisma/client';
import { now } from '../utils/helpers';
import { prisma } from '../utils/prisma';
import encryptionService from './encryption.service';
import errorService from './error.service';

class ApiKeyService {
  public async createApiKey(apiKey: ApiKey): Promise<ApiKey | null> {
    try {
      const encryptedApiKey = encryptionService.encryptApiKey(apiKey);
      const createdApiKey = await prisma.apiKey.create({
        data: encryptedApiKey,
      });

      return encryptionService.decryptApiKey(createdApiKey);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listApiKeys(environmentId: string): Promise<ApiKey[] | null> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { environment_id: environmentId, deleted_at: null },
      });

      return apiKeys.map((apiKey) => encryptionService.decryptApiKey(apiKey));
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateApiKey(
    apiKeyId: string,
    environmentId: string,
    name: string
  ): Promise<ApiKey | null> {
    try {
      const apiKey = await prisma.apiKey.update({
        where: {
          id: apiKeyId,
          environment_id: environmentId,
          deleted_at: null,
        },
        data: { name, updated_at: now() },
      });

      return encryptionService.decryptApiKey(apiKey);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteApiKey(apiKeyId: string, environmentId: string): Promise<ApiKey | null> {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: {
          id: apiKeyId,
          environment_id: environmentId,
        },
      });

      if (!apiKey) {
        return null;
      }

      return await prisma.apiKey.update({
        where: {
          id: apiKeyId,
          environment_id: environmentId,
          deleted_at: null,
        },
        data: { deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ApiKeyService();
