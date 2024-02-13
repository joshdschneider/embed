import type { LinkToken } from '@kit/shared';
import { database } from '@kit/shared';
import errorService from './error.service';

class LinkTokenService {
  public async createLinkToken(linkToken: LinkToken): Promise<LinkToken | null> {
    try {
      return await database.linkToken.create({
        data: {
          ...linkToken,
          metadata: linkToken.metadata || undefined,
          configuration: linkToken.configuration || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listLinkTokens(environmentId: string): Promise<LinkToken[] | null> {
    try {
      return await database.linkToken.findMany({
        where: { environment_id: environmentId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getLinkTokenById(linkTokenId: string): Promise<LinkToken | null> {
    try {
      return await database.linkToken.findUnique({
        where: { id: linkTokenId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateLinkToken(
    linkTokenId: string,
    data: Partial<LinkToken>
  ): Promise<LinkToken | null> {
    try {
      return await database.linkToken.update({
        where: { id: linkTokenId },
        data: {
          ...data,
          metadata: data.metadata || undefined,
          configuration: data.configuration || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteLinkToken(linkTokenId: string): Promise<LinkToken | null> {
    try {
      return await database.linkToken.delete({
        where: { id: linkTokenId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new LinkTokenService();
