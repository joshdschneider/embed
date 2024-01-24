import { LinkToken } from '@prisma/client';
import { prisma } from '../utils/prisma';
import errorService from './error.service';

class LinkTokenService {
  public async createLinkToken(linkToken: LinkToken): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.create({
        data: { ...linkToken, metadata: linkToken.metadata || undefined },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listLinkTokens(environmentId: string): Promise<LinkToken[] | null> {
    try {
      return await prisma.linkToken.findMany({
        where: { environment_id: environmentId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getLinkTokenById(
    linkTokenId: string,
    environmentId: string
  ): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.findUnique({
        where: {
          id: linkTokenId,
          environment_id: environmentId,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateLinkToken(
    linkTokenId: string,
    environmentId: string,
    data: Partial<LinkToken>
  ): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.update({
        where: {
          id: linkTokenId,
          environment_id: environmentId,
        },
        data: { ...data, metadata: data.metadata || undefined },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new LinkTokenService();
