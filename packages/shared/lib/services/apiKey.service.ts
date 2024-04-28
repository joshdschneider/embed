import type { ApiKey } from '@prisma/client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';

class ApiKeyService {
  public async createApiKey(apiKey: ApiKey): Promise<ApiKey | null> {
    try {
      const keyHash = encryptionService.hashString(apiKey.key);
      const hashedApiKey: ApiKey = { ...apiKey, key_hash: keyHash };
      const encryptedApiKey = encryptionService.encryptApiKey(hashedApiKey);
      const createdApiKey = await database.apiKey.create({
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
      const apiKeys = await database.apiKey.findMany({
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
      const apiKey = await database.apiKey.update({
        where: { id: apiKeyId, environment_id: environmentId, deleted_at: null },
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
      const apiKey = await database.apiKey.findUnique({
        where: { id: apiKeyId, environment_id: environmentId },
      });

      if (!apiKey) {
        return null;
      }

      return await database.apiKey.update({
        where: { id: apiKeyId, environment_id: environmentId, deleted_at: null },
        data: { deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ApiKeyService();
