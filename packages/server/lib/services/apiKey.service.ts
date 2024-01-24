import { ApiKey } from '@prisma/client';
import { prisma } from '../utils/prisma';
import encryptionService from './encryption.service';
import errorService from './error.service';

class ApiKeyService {
  public async createApiKey(apiKey: ApiKey): Promise<ApiKey | null> {
    try {
      const encryptedApiKey = encryptionService.encryptApiKey(apiKey);
      return await prisma.apiKey.create({
        data: encryptedApiKey,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ApiKeyService();
