import type { SessionToken } from '@embed/shared';
import { database, errorService, now } from '@embed/shared';

class SessionTokenService {
  public async createSessionToken(sessionToken: SessionToken): Promise<SessionToken | null> {
    try {
      return await database.sessionToken.create({
        data: {
          ...sessionToken,
          configuration: sessionToken.configuration || undefined,
          inclusions: sessionToken.inclusions || undefined,
          exclusions: sessionToken.exclusions || undefined,
          metadata: sessionToken.metadata || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listSessionTokens(environmentId: string): Promise<SessionToken[] | null> {
    try {
      return await database.sessionToken.findMany({
        where: { environment_id: environmentId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getSessionTokenById(sessionTokenId: string): Promise<SessionToken | null> {
    try {
      return await database.sessionToken.findUnique({
        where: { id: sessionTokenId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSessionToken(
    sessionTokenId: string,
    data: Partial<SessionToken>
  ): Promise<SessionToken | null> {
    try {
      return await database.sessionToken.update({
        where: { id: sessionTokenId },
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

  public async deleteSessionToken(sessionTokenId: string): Promise<SessionToken | null> {
    try {
      return await database.sessionToken.update({
        where: { id: sessionTokenId, deleted_at: null },
        data: { deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new SessionTokenService();
