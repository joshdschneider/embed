import type { ConnectToken } from '@embed/shared';
import { database, errorService, now } from '@embed/shared';

class ConnectTokenService {
  public async createConnectToken(connectToken: ConnectToken): Promise<ConnectToken | null> {
    try {
      return await database.connectToken.create({
        data: {
          ...connectToken,
          configuration: connectToken.configuration || undefined,
          inclusions: connectToken.inclusions || undefined,
          exclusions: connectToken.exclusions || undefined,
          metadata: connectToken.metadata || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listConnectTokens(environmentId: string): Promise<ConnectToken[] | null> {
    try {
      return await database.connectToken.findMany({
        where: { environment_id: environmentId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getConnectTokenById(connectTokenId: string): Promise<ConnectToken | null> {
    try {
      return await database.connectToken.findUnique({
        where: { id: connectTokenId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateConnectToken(
    connectTokenId: string,
    data: Partial<ConnectToken>
  ): Promise<ConnectToken | null> {
    try {
      return await database.connectToken.update({
        where: { id: connectTokenId },
        data: {
          ...data,
          configuration: data.configuration || undefined,
          inclusions: data.inclusions || undefined,
          exclusions: data.exclusions || undefined,
          metadata: data.metadata || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteConnectToken(connectTokenId: string): Promise<ConnectToken | null> {
    try {
      return await database.connectToken.update({
        where: { id: connectTokenId, deleted_at: null },
        data: { deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ConnectTokenService();
